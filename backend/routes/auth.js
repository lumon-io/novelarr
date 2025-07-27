const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const config = require('../config');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    console.log('Password check:', { username, isValid, storedHash: user.password.substring(0, 20) + '...' });
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const db = getDb();
    
    // Check if registration is enabled
    const regSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('registration_enabled');
    if (regSetting && regSetting.value === 'false') {
      return res.status(403).json({ error: 'Registration is disabled' });
    }
    
    // Get default role
    const roleSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_user_role');
    const role = roleSetting ? roleSetting.value : 'user';
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = db.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
    ).run(username, hashedPassword, role);
    
    const token = jwt.sign(
      { userId: result.lastInsertRowid, username, role },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    res.json({ 
      token, 
      user: { 
        id: result.lastInsertRowid, 
        username, 
        role 
      } 
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;