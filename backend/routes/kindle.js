const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');
const path = require('path');
const fs = require('fs').promises;

// Get user's Kindle email
router.get('/email', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT kindle_email FROM users WHERE id = ?').get(req.user.id);
    
    res.json({ kindle_email: user.kindle_email || '' });
  } catch (error) {
    console.error('Get Kindle email error:', error);
    res.status(500).json({ error: 'Failed to fetch Kindle email' });
  }
});

// Update user's Kindle email
router.put('/email', requireAuth, (req, res) => {
  const { kindle_email } = req.body;
  
  if (kindle_email && !kindle_email.match(/^[^\s@]+(@kindle\.com|@free\.kindle\.com)?$/)) {
    return res.status(400).json({ error: 'Invalid Kindle email format' });
  }
  
  try {
    const db = getDb();
    db.prepare('UPDATE users SET kindle_email = ? WHERE id = ?').run(kindle_email || null, req.user.id);
    
    res.json({ success: true, kindle_email });
  } catch (error) {
    console.error('Update Kindle email error:', error);
    res.status(500).json({ error: 'Failed to update Kindle email' });
  }
});

// Send book to Kindle by request ID
router.post('/send/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const db = getDb();
    
    // Get user's Kindle email
    const user = db.prepare('SELECT kindle_email FROM users WHERE id = ?').get(req.user.id);
    if (!user.kindle_email) {
      return res.status(400).json({ error: 'Kindle email not configured' });
    }
    
    // Get request with download info
    const request = db.prepare(`
      SELECT r.*, d.file_path, d.status as download_status
      FROM requests r
      LEFT JOIN downloads d ON r.id = d.request_id
      WHERE r.id = ? AND r.user_id = ?
    `).get(requestId, req.user.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (!request.file_path || request.download_status !== 'completed') {
      return res.status(400).json({ error: 'Book file not available or download not completed' });
    }
    
    // Check if file exists
    try {
      await fs.access(request.file_path);
    } catch (error) {
      return res.status(404).json({ error: 'Book file not found on disk' });
    }
    
    // Check file format
    const fileExt = path.extname(request.file_path).toLowerCase();
    const supportedFormats = ['.mobi', '.azw', '.azw3', '.pdf', '.txt', '.doc', '.docx', '.rtf', '.epub'];
    
    if (!supportedFormats.includes(fileExt)) {
      return res.status(400).json({ 
        error: `Unsupported file format: ${fileExt}. Kindle supports: ${supportedFormats.join(', ')}`
      });
    }
    
    // Send to Kindle
    await emailService.sendToKindle(
      req.user.email,
      user.kindle_email,
      request.file_path,
      request.book_title,
      request.book_author
    );
    
    // Log the send
    db.prepare(`
      INSERT INTO kindle_sends (user_id, request_id, kindle_email, sent_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(req.user.id, requestId, user.kindle_email);
    
    res.json({ 
      success: true, 
      message: `Book sent to ${user.kindle_email}` 
    });
  } catch (error) {
    console.error('Send to Kindle error:', error);
    res.status(500).json({ error: error.message || 'Failed to send book to Kindle' });
  }
});

// Test SMTP connection
router.get('/test-smtp', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  try {
    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('SMTP test error:', error);
    res.status(500).json({ error: 'Failed to test SMTP connection' });
  }
});

module.exports = router;