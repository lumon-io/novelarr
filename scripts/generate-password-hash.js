const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log('\nSQL Insert:');
  console.log(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', '${hash}', 'admin');`);
});