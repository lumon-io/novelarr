const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const goodreadsService = require('../services/goodreads');
const { getDb } = require('../db/database');

// OAuth flow - Step 1: Initiate
router.get('/connect', authenticateToken, async (req, res) => {
  try {
    const { token, tokenSecret } = await goodreadsService.getRequestToken();
    
    // Store request token in session/database for later use
    req.session = req.session || {};
    req.session.goodreadsRequestToken = token;
    req.session.goodreadsRequestTokenSecret = tokenSecret;
    
    const authUrl = goodreadsService.getAuthorizationUrl(token);
    res.json({ authUrl });
  } catch (error) {
    console.error('Goodreads connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OAuth flow - Step 2: Callback
router.get('/callback', authenticateToken, async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      throw new Error('Missing OAuth parameters');
    }
    
    // Retrieve request token from session
    const requestTokenSecret = req.session?.goodreadsRequestTokenSecret;
    if (!requestTokenSecret) {
      throw new Error('Request token not found');
    }
    
    // Exchange for access token
    const { accessToken, accessTokenSecret } = await goodreadsService.getAccessToken(
      oauth_token,
      requestTokenSecret,
      oauth_verifier
    );
    
    // Get user info
    const userInfo = await goodreadsService.getUserInfo(accessToken, accessTokenSecret);
    
    // Store in database
    const db = getDb();
    db.prepare(
      `INSERT OR REPLACE INTO user_goodreads 
       (user_id, goodreads_user_id, goodreads_username, access_token, 
        access_token_secret, profile_url, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      userInfo.id,
      userInfo.name,
      accessToken,
      accessTokenSecret,
      userInfo.link,
      userInfo.imageUrl
    );
    
    // Clear session
    delete req.session.goodreadsRequestToken;
    delete req.session.goodreadsRequestTokenSecret;
    
    res.redirect('/settings?goodreads=connected');
  } catch (error) {
    console.error('Goodreads callback error:', error);
    res.redirect('/settings?goodreads=error');
  }
});

// Sync library
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const result = await goodreadsService.syncUserLibrary(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Goodreads sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userGoodreads = db.prepare(
      'SELECT goodreads_username, last_sync, created_at FROM user_goodreads WHERE user_id = ?'
    ).get(req.user.id);
    
    if (!userGoodreads) {
      return res.json({ connected: false });
    }
    
    // Get book counts
    const stats = db.prepare(
      `SELECT 
        COUNT(DISTINCT book_id) as total_books,
        COUNT(DISTINCT CASE WHEN rating > 0 THEN book_id END) as rated_books,
        COUNT(DISTINCT shelf_name) as shelf_count
       FROM user_books WHERE user_id = ?`
    ).get(req.user.id);
    
    res.json({
      connected: true,
      username: userGoodreads.goodreads_username,
      lastSync: userGoodreads.last_sync,
      connectedAt: userGoodreads.created_at,
      stats
    });
  } catch (error) {
    console.error('Goodreads status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect account
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Delete all user's Goodreads data
    db.prepare('DELETE FROM user_goodreads WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_shelves WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_books WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM ai_recommendations WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM recommendation_cache WHERE user_id = ?').run(req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Goodreads disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's shelves
router.get('/shelves', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const shelves = db.prepare(
      'SELECT name, book_count, is_exclusive FROM user_shelves WHERE user_id = ? ORDER BY book_count DESC'
    ).all(req.user.id);
    
    res.json(shelves);
  } catch (error) {
    console.error('Get shelves error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's books
router.get('/books', authenticateToken, async (req, res) => {
  try {
    const { shelf, rating, limit = 50, offset = 0 } = req.query;
    const db = getDb();
    
    let query = `
      SELECT b.*, a.name as author_name, ub.rating as user_rating, 
             ub.date_read, ub.date_added, ub.shelf_name
      FROM user_books ub
      JOIN books b ON ub.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      WHERE ub.user_id = ?
    `;
    
    const params = [req.user.id];
    
    if (shelf) {
      query += ' AND ub.shelf_name = ?';
      params.push(shelf);
    }
    
    if (rating) {
      query += ' AND ub.rating = ?';
      params.push(parseInt(rating));
    }
    
    query += ' ORDER BY ub.date_added DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const books = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM user_books WHERE user_id = ?';
    const countParams = [req.user.id];
    
    if (shelf) {
      countQuery += ' AND shelf_name = ?';
      countParams.push(shelf);
    }
    
    if (rating) {
      countQuery += ' AND rating = ?';
      countParams.push(parseInt(rating));
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    res.json({ books, total });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;