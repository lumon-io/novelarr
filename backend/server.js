require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');
const config = require('./config');
const readarrSync = require('./services/readarrSync');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/search', require('./routes/search'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/library', require('./routes/library'));

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