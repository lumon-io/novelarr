const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Get user's library (all downloaded books)
router.get('/books', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        b.id, b.title, b.cover_url, b.description, b.rating,
        a.name as author_name,
        GROUP_CONCAT(DISTINCT g.name) as genres,
        GROUP_CONCAT(DISTINCT bf.file_format) as formats,
        MIN(rp.percentage) as reading_progress,
        CASE WHEN uf.book_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM books b
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON b.id = bf.book_id
      LEFT JOIN book_genres bg ON b.id = bg.book_id
      LEFT JOIN genres g ON bg.genre_id = g.id
      LEFT JOIN reading_progress rp ON b.id = rp.book_id AND rp.user_id = ?
      LEFT JOIN user_favorites uf ON b.id = uf.book_id AND uf.user_id = ?
      WHERE b.title LIKE ? OR a.name LIKE ?
      GROUP BY b.id
      ORDER BY b.added_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const searchPattern = `%${search}%`;
    const books = db.prepare(query).all(
      req.userId, req.userId, searchPattern, searchPattern, limit, offset
    );
    
    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON b.id = bf.book_id
      WHERE b.title LIKE ? OR a.name LIKE ?
    `;
    const { total } = db.prepare(countQuery).get(searchPattern, searchPattern);
    
    res.json({
      books: books.map(book => ({
        ...book,
        genres: book.genres ? book.genres.split(',') : [],
        formats: book.formats ? book.formats.split(',') : []
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get library error:', error);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// Get book details with files
router.get('/books/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    // Get book details
    const book = db.prepare(`
      SELECT 
        b.*,
        a.name as author_name,
        a.description as author_description
      FROM books b
      JOIN authors a ON b.author_id = a.id
      WHERE b.id = ?
    `).get(id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Get files
    const files = db.prepare(`
      SELECT id, file_name, file_format, file_size, quality
      FROM book_files
      WHERE book_id = ?
      ORDER BY 
        CASE file_format
          WHEN 'epub' THEN 1
          WHEN 'pdf' THEN 2
          WHEN 'mobi' THEN 3
          WHEN 'azw3' THEN 4
          ELSE 5
        END
    `).all(id);
    
    // Get genres
    const genres = db.prepare(`
      SELECT g.name
      FROM book_genres bg
      JOIN genres g ON bg.genre_id = g.id
      WHERE bg.book_id = ?
    `).all(id).map(g => g.name);
    
    // Get series info
    const series = db.prepare(`
      SELECT s.name, bs.position
      FROM book_series bs
      JOIN series s ON bs.series_id = s.id
      WHERE bs.book_id = ?
    `).get(id);
    
    // Get user's reading progress
    const progress = db.prepare(`
      SELECT file_id, percentage, position, last_read_at
      FROM reading_progress
      WHERE book_id = ? AND user_id = ?
    `).all(id, req.userId);
    
    res.json({
      ...book,
      files,
      genres,
      series,
      progress
    });
  } catch (error) {
    console.error('Get book details error:', error);
    res.status(500).json({ error: 'Failed to fetch book details' });
  }
});

// Serve book file
router.get('/books/:bookId/files/:fileId/read', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId, fileId } = req.params;
    
    // Get file info
    const file = db.prepare(`
      SELECT file_path, file_name, file_format
      FROM book_files
      WHERE id = ? AND book_id = ?
    `).get(fileId, bookId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Set appropriate content type
    const contentTypes = {
      'epub': 'application/epub+zip',
      'pdf': 'application/pdf',
      'mobi': 'application/x-mobipocket-ebook',
      'azw': 'application/vnd.amazon.ebook',
      'azw3': 'application/vnd.amazon.ebook',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'fb2': 'application/x-fb2'
    };
    
    const contentType = contentTypes[file.file_format] || 'application/octet-stream';
    
    // Get file stats
    const stat = fs.statSync(file.file_path);
    const fileSize = stat.size;
    
    // Support range requests for readers
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(file.file_path, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${file.file_name}"`
      });
      
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${file.file_name}"`
      });
      
      fs.createReadStream(file.file_path).pipe(res);
    }
    
    // Update last accessed
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, file_id, position, percentage)
      VALUES (?, ?, ?, '', 0)
      ON CONFLICT(user_id, book_id, file_id) 
      DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).run(req.userId, bookId, fileId);
    
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Download book file
router.get('/books/:bookId/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId, fileId } = req.params;
    
    // Get file info
    const file = db.prepare(`
      SELECT file_path, file_name
      FROM book_files
      WHERE id = ? AND book_id = ?
    `).get(fileId, bookId);
    
    if (!file || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(file.file_path, file.file_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Update reading progress
router.post('/books/:bookId/progress', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId } = req.params;
    const { fileId, position, percentage } = req.body;
    
    // Validate percentage
    const validPercentage = Math.max(0, Math.min(100, percentage || 0));
    
    // Update or insert progress
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, file_id, position, percentage, last_read_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, book_id, file_id) 
      DO UPDATE SET 
        position = excluded.position,
        percentage = excluded.percentage,
        last_read_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN excluded.percentage >= 100 THEN CURRENT_TIMESTAMP ELSE completed_at END
    `).run(req.userId, bookId, fileId, position || '', validPercentage);
    
    res.json({ success: true, percentage: validPercentage });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Toggle favorite
router.post('/books/:bookId/favorite', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId } = req.params;
    
    // Check if already favorited
    const existing = db.prepare(
      'SELECT 1 FROM user_favorites WHERE user_id = ? AND book_id = ?'
    ).get(req.userId, bookId);
    
    if (existing) {
      // Remove favorite
      db.prepare(
        'DELETE FROM user_favorites WHERE user_id = ? AND book_id = ?'
      ).run(req.userId, bookId);
      res.json({ favorited: false });
    } else {
      // Add favorite
      db.prepare(
        'INSERT INTO user_favorites (user_id, book_id) VALUES (?, ?)'
      ).run(req.userId, bookId);
      res.json({ favorited: true });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get user's currently reading books
router.get('/reading', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    
    const books = db.prepare(`
      SELECT 
        b.id, b.title, b.cover_url,
        a.name as author_name,
        rp.percentage, rp.last_read_at,
        bf.file_format, bf.id as file_id
      FROM reading_progress rp
      JOIN books b ON rp.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON rp.file_id = bf.id
      WHERE rp.user_id = ? AND rp.percentage > 0 AND rp.percentage < 100
      ORDER BY rp.last_read_at DESC
      LIMIT 10
    `).all(req.userId);
    
    res.json({ books });
  } catch (error) {
    console.error('Get reading list error:', error);
    res.status(500).json({ error: 'Failed to fetch reading list' });
  }
});

module.exports = router;