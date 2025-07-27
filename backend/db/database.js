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
  
  // Run all migrations in order
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of migrationFiles) {
    console.log(`Running migration: ${file}`);
    const migration = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8'
    );
    db.exec(migration);
  }
  
  console.log('Database initialized at:', config.dbPath);
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, getDb };