const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    ).all();
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  try {
    const db = getDb();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = db.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
    ).run(username, hashedPassword, role);
    
    res.json({ 
      id: result.lastInsertRowid,
      username,
      role,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;
  
  if (!username && !password && !role) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  const db = getDb();
  
  try {
    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent removing last admin
    if (user.role === 'admin' && role === 'user') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot remove last admin' });
      }
    }
    
    // Build update query
    const updates = [];
    const values = [];
    
    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    
    if (role) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push('role = ?');
      values.push(role);
    }
    
    values.push(id);
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const updatedUser = db.prepare(
      'SELECT id, username, role, created_at FROM users WHERE id = ?'
    ).get(id);
    
    res.json(updatedUser);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  try {
    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting own account
    if (user.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Prevent removing last admin
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete last admin' });
      }
    }
    
    // Delete user and their requests
    db.prepare('BEGIN').run();
    
    db.prepare('DELETE FROM requests WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    db.prepare('COMMIT').run();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user stats (admin only)
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      adminUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count,
      totalRequests: db.prepare('SELECT COUNT(*) as count FROM requests').get().count,
      requestsByUser: db.prepare(
        `SELECT u.username, COUNT(r.id) as request_count 
         FROM users u 
         LEFT JOIN requests r ON u.id = r.user_id 
         GROUP BY u.id 
         ORDER BY request_count DESC 
         LIMIT 10`
      ).all()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;