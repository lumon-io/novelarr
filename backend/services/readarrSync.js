const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('../db/database');

class ReadarrSyncService {
  constructor() {
    this.syncInterval = null;
    this.updateConfig();
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      `SELECT key, value FROM settings 
       WHERE key IN (?, ?, ?, ?, ?, ?)`
    ).all(
      'readarr_url', 
      'readarr_api_key', 
      'readarr_sync_enabled',
      'readarr_sync_interval',
      'library_root',
      'import_mode'
    );
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.readarr_sync_enabled === 'true';
    this.syncIntervalSeconds = parseInt(config.readarr_sync_interval) || 300;
    this.libraryRoot = config.library_root || '/books';
    this.importMode = config.import_mode || 'copy';
    
    if (config.readarr_url && config.readarr_api_key) {
      this.client = axios.create({
        baseURL: config.readarr_url,
        headers: {
          'X-Api-Key': config.readarr_api_key
        },
        timeout: 30000
      });
    }
  }

  async startSync() {
    if (!this.enabled || !this.client) {
      console.log('Readarr sync disabled or not configured');
      return;
    }

    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Initial sync
    await this.syncWithReadarr();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.syncWithReadarr().catch(console.error);
    }, this.syncIntervalSeconds * 1000);

    console.log(`Readarr sync started (interval: ${this.syncIntervalSeconds}s)`);
  }

  async syncWithReadarr() {
    try {
      console.log('Starting Readarr sync...');
      
      // Get all books from Readarr
      const books = await this.getReadarrBooks();
      
      // Get all book files from Readarr
      const bookFiles = await this.getReadarrBookFiles();
      
      // Process each book
      for (const book of books) {
        await this.processBook(book, bookFiles);
      }

      // Update request statuses
      await this.updateRequestStatuses(books);
      
      console.log('Readarr sync completed');
    } catch (error) {
      console.error('Readarr sync error:', error.message);
    }
  }

  async getReadarrBooks() {
    try {
      const response = await this.client.get('/api/v1/book');
      return response.data;
    } catch (error) {
      console.error('Failed to get Readarr books:', error.message);
      return [];
    }
  }

  async getReadarrBookFiles() {
    try {
      const response = await this.client.get('/api/v1/bookfile');
      return response.data;
    } catch (error) {
      console.error('Failed to get Readarr book files:', error.message);
      return [];
    }
  }

  async processBook(readarrBook, bookFiles) {
    const db = getDb();
    
    // Find files for this book
    const files = bookFiles.filter(f => f.bookId === readarrBook.id);
    if (files.length === 0) return;

    // Check if book exists in our library
    let bookId = db.prepare(
      'SELECT id FROM books WHERE goodreads_id = ?'
    ).get(readarrBook.foreignBookId)?.id;

    if (!bookId) {
      // Import book metadata
      bookId = await this.importBookMetadata(readarrBook);
    }

    // Process each file
    for (const file of files) {
      await this.processBookFile(bookId, file, readarrBook);
    }
  }

  async importBookMetadata(readarrBook) {
    const db = getDb();
    
    // Get or create author
    let authorId = db.prepare(
      'SELECT id FROM authors WHERE name = ?'
    ).get(readarrBook.author?.authorName)?.id;

    if (!authorId) {
      const result = db.prepare(
        `INSERT INTO authors (name, goodreads_id, description, image_url)
         VALUES (?, ?, ?, ?)`
      ).run(
        readarrBook.author?.authorName || 'Unknown',
        readarrBook.author?.foreignAuthorId,
        readarrBook.author?.overview,
        readarrBook.author?.images?.[0]?.url
      );
      authorId = result.lastInsertRowid;
    }

    // Insert book
    const result = db.prepare(
      `INSERT INTO books (
        title, author_id, isbn, goodreads_id, description, 
        cover_url, publication_date, publisher, page_count, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      readarrBook.title,
      authorId,
      readarrBook.editions?.[0]?.isbn13,
      readarrBook.foreignBookId,
      readarrBook.overview,
      readarrBook.images?.[0]?.url,
      readarrBook.releaseDate,
      readarrBook.editions?.[0]?.publisher,
      readarrBook.pageCount,
      readarrBook.ratings?.value
    );

    // Handle genres
    if (readarrBook.genres && readarrBook.genres.length > 0) {
      for (const genre of readarrBook.genres) {
        let genreId = db.prepare('SELECT id FROM genres WHERE name = ?').get(genre)?.id;
        
        if (!genreId) {
          const genreResult = db.prepare('INSERT INTO genres (name) VALUES (?)').run(genre);
          genreId = genreResult.lastInsertRowid;
        }
        
        db.prepare(
          'INSERT OR IGNORE INTO book_genres (book_id, genre_id) VALUES (?, ?)'
        ).run(result.lastInsertRowid, genreId);
      }
    }

    // Handle series
    if (readarrBook.seriesTitle) {
      let seriesId = db.prepare('SELECT id FROM series WHERE name = ?').get(readarrBook.seriesTitle)?.id;
      
      if (!seriesId) {
        const seriesResult = db.prepare(
          'INSERT INTO series (name, goodreads_id) VALUES (?, ?)'
        ).run(readarrBook.seriesTitle, readarrBook.seriesId);
        seriesId = seriesResult.lastInsertRowid;
      }
      
      db.prepare(
        'INSERT OR IGNORE INTO book_series (book_id, series_id, position) VALUES (?, ?, ?)'
      ).run(result.lastInsertRowid, seriesId, readarrBook.seriesPosition);
    }

    return result.lastInsertRowid;
  }

  async processBookFile(bookId, readarrFile, readarrBook) {
    const db = getDb();
    
    // Check if we already have this file
    const existingFile = db.prepare(
      'SELECT id FROM book_files WHERE file_path = ?'
    ).get(readarrFile.path);
    
    if (existingFile) return;

    // Import the file
    const fileName = path.basename(readarrFile.path);
    const fileExt = path.extname(fileName).toLowerCase().substring(1);
    
    // Create library structure
    const authorFolder = readarrBook.author?.authorName?.replace(/[^\w\s-]/g, '') || 'Unknown';
    const bookFolder = readarrBook.title.replace(/[^\w\s-]/g, '');
    const targetDir = path.join(this.libraryRoot, authorFolder, bookFolder);
    
    try {
      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });
      
      // Import file
      const targetPath = path.join(targetDir, fileName);
      
      if (this.importMode === 'copy') {
        await fs.copyFile(readarrFile.path, targetPath);
      } else {
        // Try hardlink first, fall back to copy
        try {
          await fs.link(readarrFile.path, targetPath);
        } catch (error) {
          await fs.copyFile(readarrFile.path, targetPath);
        }
      }
      
      // Calculate file hash
      const fileBuffer = await fs.readFile(targetPath);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      
      // Insert into database
      db.prepare(
        `INSERT INTO book_files (
          book_id, file_path, file_name, file_size, file_format, file_hash, quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        bookId,
        targetPath,
        fileName,
        readarrFile.size,
        fileExt,
        hash,
        readarrFile.quality?.quality?.name || 'Unknown'
      );
      
      console.log(`Imported: ${fileName}`);
    } catch (error) {
      console.error(`Failed to import ${fileName}:`, error.message);
    }
  }

  async updateRequestStatuses(readarrBooks) {
    const db = getDb();
    
    // Get all pending requests
    const requests = db.prepare(
      'SELECT id, goodreads_id, readarr_id FROM requests WHERE download_status = ?'
    ).all('pending');
    
    for (const request of requests) {
      // Find corresponding Readarr book
      const readarrBook = readarrBooks.find(
        b => b.foreignBookId === request.goodreads_id || b.id === request.readarr_id
      );
      
      if (readarrBook) {
        // Check if book has files
        const hasFiles = db.prepare(
          'SELECT COUNT(*) as count FROM book_files WHERE book_id IN (SELECT id FROM books WHERE goodreads_id = ?)'
        ).get(readarrBook.foreignBookId)?.count > 0;
        
        if (hasFiles) {
          // Update request status
          db.prepare(
            `UPDATE requests 
             SET download_status = ?, downloaded_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run('completed', request.id);
        }
      }
    }
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Readarr sync stopped');
    }
  }
}

module.exports = new ReadarrSyncService();