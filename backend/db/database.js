const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db;

function initDatabase() {
  // Ensure config directory exists
  const configDir = path.dirname(config.dbPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Open database
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  
  // Run migrations
  const migration = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_initial.sql'), 
    'utf8'
  );
  db.exec(migration);
  
  console.log('Database initialized at:', config.dbPath);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, getDb };