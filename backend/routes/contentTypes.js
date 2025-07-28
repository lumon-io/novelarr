const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Get all enabled content types
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const contentTypes = db.prepare(`
      SELECT * FROM content_types 
      WHERE enabled = 1 
      ORDER BY sort_order, display_name
    `).all();
    
    res.json(contentTypes);
  } catch (error) {
    console.error('Get content types error:', error);
    res.status(500).json({ error: 'Failed to fetch content types' });
  }
});

// Get all content types (admin only)
router.get('/all', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const contentTypes = db.prepare(`
      SELECT * FROM content_types 
      ORDER BY sort_order, display_name
    `).all();
    
    res.json(contentTypes);
  } catch (error) {
    console.error('Get all content types error:', error);
    res.status(500).json({ error: 'Failed to fetch content types' });
  }
});

// Update content type (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { enabled, media_folder, download_folder, sort_order } = req.body;
  
  try {
    const db = getDb();
    
    // Build dynamic update query
    const updates = [];
    const params = [];
    
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    
    if (media_folder !== undefined) {
      updates.push('media_folder = ?');
      params.push(media_folder);
    }
    
    if (download_folder !== undefined) {
      updates.push('download_folder = ?');
      params.push(download_folder);
    }
    
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    params.push(id);
    const query = `UPDATE content_types SET ${updates.join(', ')} WHERE id = ?`;
    
    const result = db.prepare(query).run(...params);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Content type not found' });
    }
    
    // Return updated content type
    const updated = db.prepare('SELECT * FROM content_types WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Update content type error:', error);
    res.status(500).json({ error: 'Failed to update content type' });
  }
});

// Get content type statistics
router.get('/stats', requireAuth, (req, res) => {
  try {
    const db = getDb();
    
    const stats = db.prepare(`
      SELECT 
        ct.name,
        ct.display_name,
        COUNT(DISTINCT r.id) as total_requests,
        COUNT(DISTINCT CASE WHEN d.status = 'completed' THEN r.id END) as completed_downloads,
        COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_requests
      FROM content_types ct
      LEFT JOIN requests r ON ct.name = r.content_type
      LEFT JOIN downloads d ON r.id = d.request_id
      WHERE ct.enabled = 1
      GROUP BY ct.name, ct.display_name
      ORDER BY ct.sort_order
    `).all();
    
    res.json(stats);
  } catch (error) {
    console.error('Get content type stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;