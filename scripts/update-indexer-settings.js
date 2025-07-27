const Database = require('better-sqlite3');
const path = require('path');

async function updateSettings() {
  const dbPath = process.env.DB_PATH || '/config/novelarr.db';
  const db = new Database(dbPath);
  
  console.log('Adding Jackett and Prowlarr settings...');
  
  // Add new settings if they don't exist
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)');
  
  const newSettings = [
    ['jackett_enabled', 'true', 'Enable Jackett integration'],
    ['jackett_url', 'http://192.168.1.4:9117', 'Jackett server URL'],
    ['jackett_api_key', '1zti1t0xaa4sn7jckvb2s2wwxyhqhbti', 'Jackett API key'],
    ['prowlarr_enabled', 'true', 'Enable Prowlarr integration'],
    ['prowlarr_url', 'http://192.168.1.4:9696', 'Prowlarr server URL'],
    ['prowlarr_api_key', '61a030cf205d47e4adcc2f76e92f16da', 'Prowlarr API key']
  ];
  
  for (const [key, value, description] of newSettings) {
    const result = stmt.run(key, value, description);
    console.log(`${key}: ${result.changes > 0 ? 'Added' : 'Already exists'}`);
  }
  
  // Show all settings
  console.log('\nCurrent settings:');
  const settings = db.prepare('SELECT * FROM settings ORDER BY key').all();
  settings.forEach(s => {
    console.log(`  ${s.key}: ${s.key.includes('api_key') ? '***' : s.value}`);
  });
  
  db.close();
  console.log('\nSettings updated successfully!');
}

updateSettings().catch(console.error);