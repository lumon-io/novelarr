const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

async function resetAdmin() {
  const dbPath = process.env.DB_PATH || '/config/novelarr.db';
  const db = new Database(dbPath);
  
  // Generate new hash for 'admin'
  const hash = await bcrypt.hash('admin', 10);
  console.log('New hash generated:', hash);
  
  // Update admin password
  const result = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, 'admin');
  console.log('Updated rows:', result.changes);
  
  // Verify
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  console.log('Admin user:', user);
  
  db.close();
}

resetAdmin().catch(console.error);