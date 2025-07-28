const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const readarr = require('../services/readarr');
const { requireAuth } = require('../middleware/auth');

// Get user's requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(`
      SELECT r.*, 
        d.status as download_status,
        d.progress as download_progress,
        d.file_path
      FROM requests r
      LEFT JOIN downloads d ON r.id = d.request_id
      WHERE r.user_id = ? 
      ORDER BY r.requested_at DESC
    `).all(req.userId);
    
    res.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Create new request
router.post('/', requireAuth, async (req, res) => {
  const { goodreadsId, title, author, coverUrl, contentType = 'books' } = req.body;
  
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author required' });
  }
  
  const db = getDb();
  
  try {
    // Start transaction
    db.prepare('BEGIN').run();
    
    // Check if already requested
    const existing = db.prepare(
      'SELECT * FROM requests WHERE goodreads_id = ? AND user_id = ?'
    ).get(goodreadsId, req.userId);
    
    if (existing) {
      db.prepare('ROLLBACK').run();
      return res.status(400).json({ error: 'Already requested' });
    }
    
    // Add to Readarr if API key is configured
    let readarrId = null;
    let status = 'pending';
    
    if (goodreadsId && readarr.client.defaults.headers['X-Api-Key']) {
      try {
        readarrId = await readarr.addBook(goodreadsId);
        status = 'added';
      } catch (error) {
        console.error('Failed to add to Readarr:', error.message);
        // Continue anyway - request will be pending
      }
    }
    
    // Insert request
    const result = db.prepare(
      `INSERT INTO requests (user_id, book_title, book_author, goodreads_id, cover_url, status, readarr_id, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.userId, title, author, goodreadsId, coverUrl, status, readarrId, contentType);
    
    db.prepare('COMMIT').run();
    
    res.json({ 
      id: result.lastInsertRowid,
      status,
      readarrId
    });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

module.exports = router;