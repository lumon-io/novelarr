require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { initDatabase, getDb } = require('./db/database');
const config = require('./config');
const readarrSync = require('./services/readarrSync');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session for OAuth
const getSessionSecret = () => {
  try {
    const db = getDb();
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('session_secret');
    if (result && result.value) {
      return result.value;
    }
    // Generate and save a new secret if none exists
    const crypto = require('crypto');
    const newSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newSecret, 'session_secret');
    return newSecret;
  } catch (e) {
    // Fallback during initial setup
    return process.env.SESSION_SECRET || 'novelarr-secret-key-change-in-production';
  }
};

app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/search', require('./routes/search'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/library', require('./routes/library'));
app.use('/api/goodreads', require('./routes/goodreads'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/kindle', require('./routes/kindle'));
app.use('/api/content-types', require('./routes/contentTypes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for Vue router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const port = config.port;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Novelarr running on port ${port}`);
  
  // Start Readarr sync service
  readarrSync.startSync().catch(console.error);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  readarrSync.stopSync();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  readarrSync.stopSync();
  server.close(() => {
    process.exit(0);
  });
});