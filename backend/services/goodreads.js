const crypto = require('crypto');
const OAuth = require('oauth').OAuth;
const xml2js = require('xml2js');
const { getDb } = require('../db/database');

class GoodreadsService {
  constructor() {
    this.apiKey = '';
    this.apiSecret = '';
    this.callbackUrl = '';
    this.oauth = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('goodreads_api_key', 'goodreads_api_secret', 'goodreads_callback_url');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.apiKey = config.goodreads_api_key || '';
    this.apiSecret = config.goodreads_api_secret || '';
    this.callbackUrl = config.goodreads_callback_url || 'http://localhost:8096/api/goodreads/callback';
    
    if (this.apiKey && this.apiSecret) {
      this.oauth = new OAuth(
        'https://www.goodreads.com/oauth/request_token',
        'https://www.goodreads.com/oauth/access_token',
        this.apiKey,
        this.apiSecret,
        '1.0',
        this.callbackUrl,
        'HMAC-SHA1'
      );
    } else {
      this.oauth = null;
    }
  }

  async getRequestToken() {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken((error, token, tokenSecret) => {
        if (error) {
          reject(new Error('Failed to get request token: ' + error.message));
        } else {
          resolve({ token, tokenSecret });
        }
      });
    });
  }

  getAuthorizationUrl(requestToken) {
    return `https://www.goodreads.com/oauth/authorize?oauth_token=${requestToken}`;
  }

  async getAccessToken(requestToken, requestTokenSecret, verifier) {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(
        requestToken,
        requestTokenSecret,
        verifier,
        (error, accessToken, accessTokenSecret) => {
          if (error) {
            reject(new Error('Failed to get access token: ' + error.message));
          } else {
            resolve({ accessToken, accessTokenSecret });
          }
        }
      );
    });
  }

  async getUserInfo(accessToken, accessTokenSecret) {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(
        'https://www.goodreads.com/api/auth_user',
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get user info: ' + error.message));
          } else {
            // Parse XML response
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse user info: ' + parseError.message));
              } else {
                const user = result.GoodreadsResponse?.user?.[0];
                if (user) {
                  resolve({
                    id: user.$.id,
                    name: user.name?.[0],
                    link: user.link?.[0],
                    imageUrl: user.image_url?.[0],
                    smallImageUrl: user.small_image_url?.[0]
                  });
                } else {
                  reject(new Error('Invalid user data format'));
                }
              }
            });
          }
        }
      );
    });
  }

  async getUserShelves(userId, accessToken, accessTokenSecret) {
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(
        `https://www.goodreads.com/shelf/list.xml?user_id=${userId}`,
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get shelves: ' + error.message));
          } else {
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse shelves: ' + parseError.message));
              } else {
                const shelves = result.GoodreadsResponse?.shelves?.[0]?.user_shelf || [];
                resolve(shelves.map(shelf => ({
                  id: shelf.id?.[0].$.nil === 'true' ? null : shelf.id?.[0],
                  name: shelf.name?.[0],
                  bookCount: parseInt(shelf.book_count?.[0] || 0),
                  description: shelf.description?.[0],
                  displayFields: shelf.display_fields?.[0],
                  exclusive: shelf.exclusive_flag?.[0] === 'true',
                  featured: shelf.featured?.[0] === 'true',
                  recommendFor: shelf.recommend_for?.[0] === 'true',
                  sortable: shelf.sort?.[0] === 'true'
                })));
              }
            });
          }
        }
      );
    });
  }

  async getShelfBooks(userId, shelfName, accessToken, accessTokenSecret, page = 1) {
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      const url = `https://www.goodreads.com/review/list/${userId}.xml?v=2&shelf=${shelfName}&page=${page}&per_page=50`;
      
      this.oauth.get(
        url,
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get shelf books: ' + error.message));
          } else {
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse shelf books: ' + parseError.message));
              } else {
                const reviews = result.GoodreadsResponse?.reviews?.[0]?.review || [];
                const books = reviews.map(review => ({
                  id: review.book?.[0].id?.[0]._,
                  title: review.book?.[0].title?.[0],
                  author: review.book?.[0].authors?.[0]?.author?.[0]?.name?.[0],
                  isbn: review.book?.[0].isbn?.[0],
                  isbn13: review.book?.[0].isbn13?.[0],
                  imageUrl: review.book?.[0].image_url?.[0],
                  smallImageUrl: review.book?.[0].small_image_url?.[0],
                  publicationYear: review.book?.[0].publication_year?.[0],
                  averageRating: parseFloat(review.book?.[0].average_rating?.[0] || 0),
                  ratingsCount: parseInt(review.book?.[0].ratings_count?.[0] || 0),
                  description: review.book?.[0].description?.[0],
                  numPages: parseInt(review.book?.[0].num_pages?.[0] || 0),
                  userRating: parseInt(review.rating?.[0] || 0),
                  dateRead: review.read_at?.[0],
                  dateAdded: review.date_added?.[0],
                  shelves: review.shelves?.[0]?.shelf?.map(s => s.$.name) || []
                }));
                
                resolve({
                  books,
                  total: parseInt(result.GoodreadsResponse?.reviews?.[0].$?.total || 0),
                  page: parseInt(result.GoodreadsResponse?.reviews?.[0].$?.page || 1)
                });
              }
            });
          }
        }
      );
    });
  }

  async syncUserLibrary(userId) {
    const db = getDb();
    
    // Get user's Goodreads credentials
    const userGoodreads = db.prepare(
      'SELECT * FROM user_goodreads WHERE user_id = ?'
    ).get(userId);
    
    if (!userGoodreads) {
      throw new Error('User has not connected Goodreads account');
    }
    
    const { access_token, access_token_secret, goodreads_user_id } = userGoodreads;
    
    try {
      // Sync shelves
      const shelves = await this.getUserShelves(goodreads_user_id, access_token, access_token_secret);
      
      for (const shelf of shelves) {
        db.prepare(
          `INSERT OR REPLACE INTO user_shelves 
           (user_id, goodreads_shelf_id, name, book_count, is_exclusive)
           VALUES (?, ?, ?, ?, ?)`
        ).run(userId, shelf.id || shelf.name, shelf.name, shelf.bookCount, shelf.exclusive ? 1 : 0);
      }
      
      // Sync books from each shelf
      for (const shelf of shelves) {
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const result = await this.getShelfBooks(
            goodreads_user_id, 
            shelf.name, 
            access_token, 
            access_token_secret, 
            page
          );
          
          for (const book of result.books) {
            // Check if book exists in our database
            let bookId = db.prepare(
              'SELECT id FROM books WHERE goodreads_id = ?'
            ).get(book.id)?.id;
            
            if (!bookId) {
              // Import book metadata
              bookId = await this.importBook(book);
            }
            
            // Update user's book record
            db.prepare(
              `INSERT OR REPLACE INTO user_books 
               (user_id, book_id, goodreads_book_id, shelf_name, rating, date_read, date_added)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              userId,
              bookId,
              book.id,
              shelf.name,
              book.userRating,
              book.dateRead,
              book.dateAdded
            );
          }
          
          hasMore = (page * 50) < result.total;
          page++;
        }
      }
      
      // Update last sync time
      db.prepare(
        'UPDATE user_goodreads SET last_sync = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).run(userId);
      
      return { success: true, message: 'Library synced successfully' };
    } catch (error) {
      console.error('Goodreads sync error:', error);
      throw error;
    }
  }

  async importBook(goodreadsBook) {
    const db = getDb();
    
    // Get or create author
    let authorId = db.prepare(
      'SELECT id FROM authors WHERE name = ?'
    ).get(goodreadsBook.author)?.id;
    
    if (!authorId) {
      const result = db.prepare(
        'INSERT INTO authors (name, goodreads_id) VALUES (?, ?)'
      ).run(goodreadsBook.author || 'Unknown', null);
      authorId = result.lastInsertRowid;
    }
    
    // Insert book
    const result = db.prepare(
      `INSERT INTO books (
        title, author_id, isbn, goodreads_id, description,
        cover_url, publication_date, page_count, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goodreadsBook.title,
      authorId,
      goodreadsBook.isbn13 || goodreadsBook.isbn,
      goodreadsBook.id,
      goodreadsBook.description,
      goodreadsBook.imageUrl,
      goodreadsBook.publicationYear,
      goodreadsBook.numPages,
      goodreadsBook.averageRating
    );
    
    return result.lastInsertRowid;
  }

  async searchBooks(query) {
    this.updateConfig();
    if (!this.apiKey) {
      throw new Error('Goodreads API key not configured');
    }

    // Note: This uses the public API endpoint that doesn't require OAuth
    const url = `https://www.goodreads.com/search/index.xml?key=${this.apiKey}&q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.text();
      
      return new Promise((resolve, reject) => {
        xml2js.parseString(data, (error, result) => {
          if (error) {
            reject(new Error('Failed to parse search results: ' + error.message));
          } else {
            const works = result.GoodreadsResponse?.search?.[0]?.results?.[0]?.work || [];
            const books = works.map(work => ({
              goodreadsId: work.best_book?.[0].id?.[0]._,
              title: work.best_book?.[0].title?.[0],
              author: work.best_book?.[0].author?.[0].name?.[0],
              imageUrl: work.best_book?.[0].image_url?.[0],
              smallImageUrl: work.best_book?.[0].small_image_url?.[0],
              publicationYear: work.original_publication_year?.[0]._,
              averageRating: parseFloat(work.average_rating?.[0] || 0),
              ratingsCount: parseInt(work.ratings_count?.[0]._ || 0),
              textReviewsCount: parseInt(work.text_reviews_count?.[0]._ || 0)
            }));
            resolve(books);
          }
        });
      });
    } catch (error) {
      throw new Error('Failed to search Goodreads: ' + error.message);
    }
  }
}

module.exports = new GoodreadsService();