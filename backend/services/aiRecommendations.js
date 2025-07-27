const OpenAI = require('openai');
const { getDb } = require('../db/database');

class AIRecommendationService {
  constructor() {
    this.apiKey = '';
    this.model = 'gpt-4-turbo-preview';
    this.enabled = false;
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.openai = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('openai_api_key', 'openai_model', 'ai_recommendations_enabled');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.apiKey = config.openai_api_key || '';
    this.model = config.openai_model || 'gpt-4-turbo-preview';
    this.enabled = config.ai_recommendations_enabled === 'true';
    
    if (this.apiKey && this.enabled) {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
    } else {
      this.openai = null;
    }
  }

  async getRecommendations(userId, limit = 10) {
    this.updateConfig();
    const db = getDb();
    
    if (!this.enabled) {
      throw new Error('AI recommendations are not enabled');
    }
    
    // Check cache first
    const cacheKey = `recommendations_${limit}`;
    const cached = db.prepare(
      `SELECT recommendations FROM recommendation_cache 
       WHERE user_id = ? AND cache_key = ? AND expires_at > datetime('now')`
    ).get(userId, cacheKey);
    
    if (cached) {
      return JSON.parse(cached.recommendations);
    }
    
    // Get user's reading history
    const readingHistory = await this.getUserReadingHistory(userId);
    
    if (readingHistory.length === 0) {
      throw new Error('No reading history found. Please sync your Goodreads library first.');
    }
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(readingHistory, limit);
    
    // Cache recommendations
    const expiresAt = new Date(Date.now() + this.cacheExpiry).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO recommendation_cache 
       (user_id, cache_key, recommendations, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(userId, cacheKey, JSON.stringify(recommendations), expiresAt);
    
    // Store individual recommendations
    for (const rec of recommendations) {
      // Check if book exists
      let bookId = db.prepare(
        'SELECT id FROM books WHERE title = ? AND author_id IN (SELECT id FROM authors WHERE name = ?)'
      ).get(rec.title, rec.author)?.id;
      
      if (!bookId) {
        // Create book entry
        let authorId = db.prepare('SELECT id FROM authors WHERE name = ?').get(rec.author)?.id;
        
        if (!authorId) {
          const authorResult = db.prepare(
            'INSERT INTO authors (name) VALUES (?)'
          ).run(rec.author);
          authorId = authorResult.lastInsertRowid;
        }
        
        const bookResult = db.prepare(
          `INSERT INTO books (title, author_id, description, cover_url, publication_date)
           VALUES (?, ?, ?, ?, ?)`
        ).run(rec.title, authorId, rec.description, rec.coverUrl, rec.publicationYear);
        bookId = bookResult.lastInsertRowid;
      }
      
      // Store AI recommendation
      db.prepare(
        `INSERT OR REPLACE INTO ai_recommendations 
         (user_id, book_id, score, reasoning, model_version, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, bookId, rec.score, rec.reasoning, this.model, expiresAt);
    }
    
    return recommendations;
  }

  async getUserReadingHistory(userId) {
    const db = getDb();
    
    // Get user's books with ratings and read status
    const books = db.prepare(
      `SELECT b.title, a.name as author, b.description, 
              ub.rating, ub.date_read, ub.shelf_name,
              g.name as genre
       FROM user_books ub
       JOIN books b ON ub.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       LEFT JOIN book_genres bg ON b.id = bg.book_id
       LEFT JOIN genres g ON bg.genre_id = g.id
       WHERE ub.user_id = ?
       ORDER BY ub.date_read DESC, ub.date_added DESC
       LIMIT 100`
    ).all(userId);
    
    // Group genres by book
    const bookMap = new Map();
    books.forEach(book => {
      const key = `${book.title}_${book.author}`;
      if (!bookMap.has(key)) {
        bookMap.set(key, {
          title: book.title,
          author: book.author,
          description: book.description,
          rating: book.rating,
          dateRead: book.date_read,
          shelf: book.shelf_name,
          genres: []
        });
      }
      if (book.genre) {
        bookMap.get(key).genres.push(book.genre);
      }
    });
    
    return Array.from(bookMap.values());
  }

  async generateRecommendations(readingHistory, limit) {
    this.updateConfig();
    if (!this.openai) {
      throw new Error('OpenAI API key not configured or AI recommendations disabled');
    }
    
    // Prepare reading history summary
    const favoriteBooks = readingHistory
      .filter(b => b.rating >= 4)
      .slice(0, 20)
      .map(b => `${b.title} by ${b.author} (${b.rating}/5)`);
    
    const recentBooks = readingHistory
      .filter(b => b.dateRead)
      .slice(0, 10)
      .map(b => `${b.title} by ${b.author}`);
    
    const genres = [...new Set(readingHistory.flatMap(b => b.genres))].slice(0, 15);
    
    const prompt = `Based on this reading history, recommend ${limit} books that the user would enjoy.

Favorite books (rated 4-5 stars):
${favoriteBooks.join('\n')}

Recently read:
${recentBooks.join('\n')}

Preferred genres: ${genres.join(', ')}

Please recommend books that:
1. Match the user's demonstrated preferences
2. Are similar in quality to their highly-rated books
3. Introduce some variety while staying within their interests
4. Include both popular and lesser-known titles

For each recommendation, provide:
- Title
- Author
- Publication year
- A brief description (2-3 sentences)
- Why this book would appeal to this reader (1-2 sentences)
- A relevance score from 0.0 to 1.0

Format as JSON array with fields: title, author, publicationYear, description, reasoning, score`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable book recommendation expert who provides personalized suggestions based on reading history.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      const recommendations = result.recommendations || result.books || [];
      
      // Enhance with additional data if available
      return await this.enhanceRecommendations(recommendations);
    } catch (error) {
      console.error('AI recommendation error:', error);
      throw new Error('Failed to generate recommendations: ' + error.message);
    }
  }

  async enhanceRecommendations(recommendations) {
    // Try to fetch cover images and additional metadata from Goodreads
    const goodreadsService = require('./goodreads');
    
    for (const rec of recommendations) {
      try {
        const searchResults = await goodreadsService.searchBooks(`${rec.title} ${rec.author}`);
        if (searchResults.length > 0) {
          const match = searchResults[0];
          rec.coverUrl = match.imageUrl || '/placeholder.jpg';
          rec.goodreadsId = match.goodreadsId;
          rec.averageRating = match.averageRating;
          rec.ratingsCount = match.ratingsCount;
        } else {
          rec.coverUrl = '/placeholder.jpg';
        }
      } catch (error) {
        rec.coverUrl = '/placeholder.jpg';
      }
    }
    
    return recommendations;
  }

  async getPersonalizedRecommendation(userId, bookId) {
    this.updateConfig();
    const db = getDb();
    
    if (!this.enabled) {
      throw new Error('AI recommendations are not enabled');
    }
    
    // Check if we have a cached recommendation
    const cached = db.prepare(
      `SELECT score, reasoning FROM ai_recommendations 
       WHERE user_id = ? AND book_id = ? AND expires_at > datetime('now')`
    ).get(userId, bookId);
    
    if (cached) {
      return cached;
    }
    
    // Get book details
    const book = db.prepare(
      `SELECT b.title, a.name as author, b.description
       FROM books b
       JOIN authors a ON b.author_id = a.id
       WHERE b.id = ?`
    ).get(bookId);
    
    if (!book) {
      throw new Error('Book not found');
    }
    
    // Get user preferences
    const readingHistory = await this.getUserReadingHistory(userId);
    
    // Generate personalized assessment
    const assessment = await this.assessBookForUser(book, readingHistory);
    
    // Store the assessment
    const expiresAt = new Date(Date.now() + this.cacheExpiry).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO ai_recommendations 
       (user_id, book_id, score, reasoning, model_version, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, bookId, assessment.score, assessment.reasoning, this.model, expiresAt);
    
    return assessment;
  }

  async assessBookForUser(book, readingHistory) {
    this.updateConfig();
    if (!this.openai) {
      throw new Error('OpenAI API key not configured or AI recommendations disabled');
    }
    
    const favoriteBooks = readingHistory
      .filter(b => b.rating >= 4)
      .slice(0, 10)
      .map(b => `${b.title} by ${b.author}`);
    
    const prompt = `Assess how well this book would match the user's preferences:

Book to assess:
"${book.title}" by ${book.author}
${book.description}

User's favorite books:
${favoriteBooks.join('\n')}

Provide:
1. A match score from 0.0 to 1.0
2. A brief explanation (2-3 sentences) of why this book would or wouldn't appeal to this reader

Format as JSON with fields: score, reasoning`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a book recommendation expert who assesses book matches based on reading preferences.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('AI assessment error:', error);
      return {
        score: 0.5,
        reasoning: 'Unable to generate personalized assessment at this time.'
      };
    }
  }
}

module.exports = new AIRecommendationService();