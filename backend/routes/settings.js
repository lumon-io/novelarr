const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// Get all settings (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings').all();
    
    // Convert to object format
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = {
        value: setting.value,
        description: setting.description
      };
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (admin only)
router.put('/', requireAdmin, (req, res) => {
  const updates = req.body;
  
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings data' });
  }
  
  const db = getDb();
  
  try {
    db.prepare('BEGIN').run();
    
    const stmt = db.prepare(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?'
    );
    
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== 'string') {
        continue; // Skip non-string values
      }
      
      const result = stmt.run(value, key);
      if (result.changes === 0) {
        console.warn(`Setting key '${key}' not found`);
      }
    }
    
    db.prepare('COMMIT').run();
    
    // Return updated settings
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = {
        value: setting.value,
        description: setting.description
      };
    });
    
    res.json(settingsObj);
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get public settings (for registration check etc)
router.get('/public', (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('app_name', 'registration_enabled', 'require_approval');
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;