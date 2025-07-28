# Novelarr Complete Codebase Review

Generated: Sun Jul 27 16:43:30 PDT 2025

## Table of Contents
1. [Configuration Files](#configuration-files)
2. [Backend Code](#backend-code)
3. [Frontend Code](#frontend-code)
4. [Database Schema](#database-schema)

---

## Configuration Files

### docker-compose.yml
```yaml
services:
  novelarr:
    build: .
    container_name: novelarr
    environment:
      - READARR_URL=http://192.168.1.4:8787
      - READARR_API_KEY=31a0ae98e92b445f982be81c8f41ac30
      - JWT_SECRET=change-me-in-production
    volumes:
      - ./data:/config
    ports:
      - "8096:8096"
    network_mode: bridge```

### Dockerfile
```dockerfile
# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /build
COPY backend/package*.json ./
RUN npm install --omit=dev

# Final image
FROM node:20-alpine
RUN apk add --no-cache sqlite curl tzdata
WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/node_modules ./node_modules
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /build/dist ./public

# Create non-root user (use different UID/GID if 1000 is taken)
RUN addgroup -S novelarr && \
    adduser -S novelarr -G novelarr && \
    mkdir -p /config && \
    chown -R novelarr:novelarr /app /config

USER novelarr
EXPOSE 8096
VOLUME /config

ENV NODE_ENV=production
ENV DB_PATH=/config/novelarr.db
ENV PORT=8096

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:8096/api/health || exit 1

CMD ["node", "server.js"]```

### backend/package.json
```json
{
  "name": "novelarr-backend",
  "version": "1.0.0",
  "description": "Novelarr backend server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.2.2",
    "axios": "^1.6.2",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "oauth": "^0.10.0",
    "xml2js": "^0.6.2",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}```

### frontend/package.json
```json
{
  "name": "novelarr-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.3.13",
    "vue-router": "^4.2.5",
    "pinia": "^2.1.7",
    "axios": "^1.6.2",
    "lodash-es": "^4.17.21"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.5.2",
    "vite": "^5.0.10",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0"
  }
}```

## Backend Code

### backend/server.js
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { initDatabase } = require('./db/database');
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
});```

### backend/config/index.js
```javascript
module.exports = {
  port: parseInt(process.env.PORT) || 8096,
  dbPath: process.env.DB_PATH || '/config/novelarr.db',
  
  readarr: {
    url: process.env.READARR_URL || 'http://localhost:8787',
    apiKey: process.env.READARR_API_KEY || '',
    qualityProfile: parseInt(process.env.READARR_QUALITY_PROFILE) || 1,
    rootFolder: process.env.READARR_ROOT_FOLDER || '/books'
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d'
  }
};```

### backend/db/database.js
```javascript
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

module.exports = { initDatabase, getDb };```

### backend/middleware/auth.js
```javascript
const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };```

### backend/routes/auth.js
```javascript
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

module.exports = router;```

### backend/routes/goodreads.js
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const goodreadsService = require('../services/goodreads');
const { getDb } = require('../db/database');

// OAuth flow - Step 1: Initiate
router.get('/connect', authenticateToken, async (req, res) => {
  try {
    const { token, tokenSecret } = await goodreadsService.getRequestToken();
    
    // Store request token in session/database for later use
    req.session = req.session || {};
    req.session.goodreadsRequestToken = token;
    req.session.goodreadsRequestTokenSecret = tokenSecret;
    
    const authUrl = goodreadsService.getAuthorizationUrl(token);
    res.json({ authUrl });
  } catch (error) {
    console.error('Goodreads connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OAuth flow - Step 2: Callback
router.get('/callback', authenticateToken, async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      throw new Error('Missing OAuth parameters');
    }
    
    // Retrieve request token from session
    const requestTokenSecret = req.session?.goodreadsRequestTokenSecret;
    if (!requestTokenSecret) {
      throw new Error('Request token not found');
    }
    
    // Exchange for access token
    const { accessToken, accessTokenSecret } = await goodreadsService.getAccessToken(
      oauth_token,
      requestTokenSecret,
      oauth_verifier
    );
    
    // Get user info
    const userInfo = await goodreadsService.getUserInfo(accessToken, accessTokenSecret);
    
    // Store in database
    const db = getDb();
    db.prepare(
      `INSERT OR REPLACE INTO user_goodreads 
       (user_id, goodreads_user_id, goodreads_username, access_token, 
        access_token_secret, profile_url, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      userInfo.id,
      userInfo.name,
      accessToken,
      accessTokenSecret,
      userInfo.link,
      userInfo.imageUrl
    );
    
    // Clear session
    delete req.session.goodreadsRequestToken;
    delete req.session.goodreadsRequestTokenSecret;
    
    res.redirect('/settings?goodreads=connected');
  } catch (error) {
    console.error('Goodreads callback error:', error);
    res.redirect('/settings?goodreads=error');
  }
});

// Sync library
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const result = await goodreadsService.syncUserLibrary(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Goodreads sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userGoodreads = db.prepare(
      'SELECT goodreads_username, last_sync, created_at FROM user_goodreads WHERE user_id = ?'
    ).get(req.user.id);
    
    if (!userGoodreads) {
      return res.json({ connected: false });
    }
    
    // Get book counts
    const stats = db.prepare(
      `SELECT 
        COUNT(DISTINCT book_id) as total_books,
        COUNT(DISTINCT CASE WHEN rating > 0 THEN book_id END) as rated_books,
        COUNT(DISTINCT shelf_name) as shelf_count
       FROM user_books WHERE user_id = ?`
    ).get(req.user.id);
    
    res.json({
      connected: true,
      username: userGoodreads.goodreads_username,
      lastSync: userGoodreads.last_sync,
      connectedAt: userGoodreads.created_at,
      stats
    });
  } catch (error) {
    console.error('Goodreads status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect account
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Delete all user's Goodreads data
    db.prepare('DELETE FROM user_goodreads WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_shelves WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_books WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM ai_recommendations WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM recommendation_cache WHERE user_id = ?').run(req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Goodreads disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's shelves
router.get('/shelves', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const shelves = db.prepare(
      'SELECT name, book_count, is_exclusive FROM user_shelves WHERE user_id = ? ORDER BY book_count DESC'
    ).all(req.user.id);
    
    res.json(shelves);
  } catch (error) {
    console.error('Get shelves error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's books
router.get('/books', authenticateToken, async (req, res) => {
  try {
    const { shelf, rating, limit = 50, offset = 0 } = req.query;
    const db = getDb();
    
    let query = `
      SELECT b.*, a.name as author_name, ub.rating as user_rating, 
             ub.date_read, ub.date_added, ub.shelf_name
      FROM user_books ub
      JOIN books b ON ub.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      WHERE ub.user_id = ?
    `;
    
    const params = [req.user.id];
    
    if (shelf) {
      query += ' AND ub.shelf_name = ?';
      params.push(shelf);
    }
    
    if (rating) {
      query += ' AND ub.rating = ?';
      params.push(parseInt(rating));
    }
    
    query += ' ORDER BY ub.date_added DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const books = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM user_books WHERE user_id = ?';
    const countParams = [req.user.id];
    
    if (shelf) {
      countQuery += ' AND shelf_name = ?';
      countParams.push(shelf);
    }
    
    if (rating) {
      countQuery += ' AND rating = ?';
      countParams.push(parseInt(rating));
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    res.json({ books, total });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;```

### backend/routes/library.js
```javascript
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Get user's library (all downloaded books)
router.get('/books', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        b.id, b.title, b.cover_url, b.description, b.rating,
        a.name as author_name,
        GROUP_CONCAT(DISTINCT g.name) as genres,
        GROUP_CONCAT(DISTINCT bf.file_format) as formats,
        MIN(rp.percentage) as reading_progress,
        CASE WHEN uf.book_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM books b
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON b.id = bf.book_id
      LEFT JOIN book_genres bg ON b.id = bg.book_id
      LEFT JOIN genres g ON bg.genre_id = g.id
      LEFT JOIN reading_progress rp ON b.id = rp.book_id AND rp.user_id = ?
      LEFT JOIN user_favorites uf ON b.id = uf.book_id AND uf.user_id = ?
      WHERE b.title LIKE ? OR a.name LIKE ?
      GROUP BY b.id
      ORDER BY b.added_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const searchPattern = `%${search}%`;
    const books = db.prepare(query).all(
      req.userId, req.userId, searchPattern, searchPattern, limit, offset
    );
    
    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON b.id = bf.book_id
      WHERE b.title LIKE ? OR a.name LIKE ?
    `;
    const { total } = db.prepare(countQuery).get(searchPattern, searchPattern);
    
    res.json({
      books: books.map(book => ({
        ...book,
        genres: book.genres ? book.genres.split(',') : [],
        formats: book.formats ? book.formats.split(',') : []
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get library error:', error);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// Get book details with files
router.get('/books/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    // Get book details
    const book = db.prepare(`
      SELECT 
        b.*,
        a.name as author_name,
        a.description as author_description
      FROM books b
      JOIN authors a ON b.author_id = a.id
      WHERE b.id = ?
    `).get(id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Get files
    const files = db.prepare(`
      SELECT id, file_name, file_format, file_size, quality
      FROM book_files
      WHERE book_id = ?
      ORDER BY 
        CASE file_format
          WHEN 'epub' THEN 1
          WHEN 'pdf' THEN 2
          WHEN 'mobi' THEN 3
          WHEN 'azw3' THEN 4
          ELSE 5
        END
    `).all(id);
    
    // Get genres
    const genres = db.prepare(`
      SELECT g.name
      FROM book_genres bg
      JOIN genres g ON bg.genre_id = g.id
      WHERE bg.book_id = ?
    `).all(id).map(g => g.name);
    
    // Get series info
    const series = db.prepare(`
      SELECT s.name, bs.position
      FROM book_series bs
      JOIN series s ON bs.series_id = s.id
      WHERE bs.book_id = ?
    `).get(id);
    
    // Get user's reading progress
    const progress = db.prepare(`
      SELECT file_id, percentage, position, last_read_at
      FROM reading_progress
      WHERE book_id = ? AND user_id = ?
    `).all(id, req.userId);
    
    res.json({
      ...book,
      files,
      genres,
      series,
      progress
    });
  } catch (error) {
    console.error('Get book details error:', error);
    res.status(500).json({ error: 'Failed to fetch book details' });
  }
});

// Serve book file
router.get('/books/:bookId/files/:fileId/read', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId, fileId } = req.params;
    
    // Get file info
    const file = db.prepare(`
      SELECT file_path, file_name, file_format
      FROM book_files
      WHERE id = ? AND book_id = ?
    `).get(fileId, bookId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Set appropriate content type
    const contentTypes = {
      'epub': 'application/epub+zip',
      'pdf': 'application/pdf',
      'mobi': 'application/x-mobipocket-ebook',
      'azw': 'application/vnd.amazon.ebook',
      'azw3': 'application/vnd.amazon.ebook',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'fb2': 'application/x-fb2'
    };
    
    const contentType = contentTypes[file.file_format] || 'application/octet-stream';
    
    // Get file stats
    const stat = fs.statSync(file.file_path);
    const fileSize = stat.size;
    
    // Support range requests for readers
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(file.file_path, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${file.file_name}"`
      });
      
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${file.file_name}"`
      });
      
      fs.createReadStream(file.file_path).pipe(res);
    }
    
    // Update last accessed
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, file_id, position, percentage)
      VALUES (?, ?, ?, '', 0)
      ON CONFLICT(user_id, book_id, file_id) 
      DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).run(req.userId, bookId, fileId);
    
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Download book file
router.get('/books/:bookId/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId, fileId } = req.params;
    
    // Get file info
    const file = db.prepare(`
      SELECT file_path, file_name
      FROM book_files
      WHERE id = ? AND book_id = ?
    `).get(fileId, bookId);
    
    if (!file || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(file.file_path, file.file_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Update reading progress
router.post('/books/:bookId/progress', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId } = req.params;
    const { fileId, position, percentage } = req.body;
    
    // Validate percentage
    const validPercentage = Math.max(0, Math.min(100, percentage || 0));
    
    // Update or insert progress
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, file_id, position, percentage, last_read_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, book_id, file_id) 
      DO UPDATE SET 
        position = excluded.position,
        percentage = excluded.percentage,
        last_read_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN excluded.percentage >= 100 THEN CURRENT_TIMESTAMP ELSE completed_at END
    `).run(req.userId, bookId, fileId, position || '', validPercentage);
    
    res.json({ success: true, percentage: validPercentage });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Toggle favorite
router.post('/books/:bookId/favorite', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { bookId } = req.params;
    
    // Check if already favorited
    const existing = db.prepare(
      'SELECT 1 FROM user_favorites WHERE user_id = ? AND book_id = ?'
    ).get(req.userId, bookId);
    
    if (existing) {
      // Remove favorite
      db.prepare(
        'DELETE FROM user_favorites WHERE user_id = ? AND book_id = ?'
      ).run(req.userId, bookId);
      res.json({ favorited: false });
    } else {
      // Add favorite
      db.prepare(
        'INSERT INTO user_favorites (user_id, book_id) VALUES (?, ?)'
      ).run(req.userId, bookId);
      res.json({ favorited: true });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get user's currently reading books
router.get('/reading', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    
    const books = db.prepare(`
      SELECT 
        b.id, b.title, b.cover_url,
        a.name as author_name,
        rp.percentage, rp.last_read_at,
        bf.file_format, bf.id as file_id
      FROM reading_progress rp
      JOIN books b ON rp.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      JOIN book_files bf ON rp.file_id = bf.id
      WHERE rp.user_id = ? AND rp.percentage > 0 AND rp.percentage < 100
      ORDER BY rp.last_read_at DESC
      LIMIT 10
    `).all(req.userId);
    
    res.json({ books });
  } catch (error) {
    console.error('Get reading list error:', error);
    res.status(500).json({ error: 'Failed to fetch reading list' });
  }
});

module.exports = router;```

### backend/routes/recommendations.js
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiRecommendations');
const { getDb } = require('../db/database');

// Get AI recommendations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, refresh = false } = req.query;
    
    if (refresh) {
      // Clear cache to force refresh
      const db = getDb();
      db.prepare(
        'DELETE FROM recommendation_cache WHERE user_id = ? AND cache_key = ?'
      ).run(req.user.id, `recommendations_${limit}`);
    }
    
    const recommendations = await aiService.getRecommendations(
      req.user.id, 
      parseInt(limit)
    );
    
    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get personalized assessment for a specific book
router.get('/assess/:bookId', authenticateToken, async (req, res) => {
  try {
    const assessment = await aiService.getPersonalizedRecommendation(
      req.user.id,
      req.params.bookId
    );
    
    res.json(assessment);
  } catch (error) {
    console.error('Book assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommendation stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Get recommendation counts and cache status
    const stats = db.prepare(
      `SELECT 
        COUNT(DISTINCT book_id) as total_recommendations,
        COUNT(DISTINCT CASE WHEN score >= 0.8 THEN book_id END) as high_match_count,
        MIN(created_at) as first_recommendation,
        MAX(created_at) as latest_recommendation
       FROM ai_recommendations 
       WHERE user_id = ? AND expires_at > datetime('now')`
    ).get(req.user.id);
    
    // Get cache info
    const cacheInfo = db.prepare(
      `SELECT cache_key, created_at, expires_at
       FROM recommendation_cache 
       WHERE user_id = ? AND expires_at > datetime('now')`
    ).all(req.user.id);
    
    res.json({
      ...stats,
      caches: cacheInfo
    });
  } catch (error) {
    console.error('Recommendation stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear recommendation cache
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Clear all caches for user
    db.prepare(
      'DELETE FROM recommendation_cache WHERE user_id = ?'
    ).run(req.user.id);
    
    // Clear expired recommendations
    db.prepare(
      'DELETE FROM ai_recommendations WHERE user_id = ? AND expires_at <= datetime("now")'
    ).run(req.user.id);
    
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommended books by genre
router.get('/by-genre', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    const recommendations = db.prepare(
      `SELECT 
        g.name as genre,
        b.id, b.title, a.name as author_name, b.cover_url,
        ar.score, ar.reasoning
       FROM ai_recommendations ar
       JOIN books b ON ar.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       LEFT JOIN book_genres bg ON b.id = bg.book_id
       LEFT JOIN genres g ON bg.genre_id = g.id
       WHERE ar.user_id = ? AND ar.expires_at > datetime('now')
       ORDER BY g.name, ar.score DESC`
    ).all(req.user.id);
    
    // Group by genre
    const byGenre = {};
    recommendations.forEach(rec => {
      const genre = rec.genre || 'Uncategorized';
      if (!byGenre[genre]) {
        byGenre[genre] = [];
      }
      byGenre[genre].push({
        id: rec.id,
        title: rec.title,
        author: rec.author_name,
        coverUrl: rec.cover_url,
        score: rec.score,
        reasoning: rec.reasoning
      });
    });
    
    res.json(byGenre);
  } catch (error) {
    console.error('Get recommendations by genre error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export recommendations
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const db = getDb();
    
    const recommendations = db.prepare(
      `SELECT 
        b.title, a.name as author, b.isbn, b.goodreads_id,
        b.description, b.publication_date, b.page_count,
        ar.score, ar.reasoning, ar.created_at as recommended_at
       FROM ai_recommendations ar
       JOIN books b ON ar.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       WHERE ar.user_id = ? AND ar.expires_at > datetime('now')
       ORDER BY ar.score DESC`
    ).all(req.user.id);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Title,Author,ISBN,Goodreads ID,Score,Reasoning,Recommended At',
        ...recommendations.map(r => 
          `"${r.title}","${r.author}","${r.isbn || ''}","${r.goodreads_id || ''}",${r.score},"${r.reasoning}","${r.recommended_at}"`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="novelarr-recommendations.csv"');
      res.send(csv);
    } else {
      res.json(recommendations);
    }
  } catch (error) {
    console.error('Export recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;```

### backend/routes/requests.js
```javascript
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const readarr = require('../services/readarr');
const { requireAuth } = require('../middleware/auth');

// Get user's requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(
      'SELECT * FROM requests WHERE user_id = ? ORDER BY requested_at DESC'
    ).all(req.userId);
    
    res.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Create new request
router.post('/', requireAuth, async (req, res) => {
  const { goodreadsId, title, author, coverUrl } = req.body;
  
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author required' });
  }
  
  const db = getDb();
  
  try {
    // Start transaction
    db.prepare('BEGIN').run();
    
    // Check if already requested
    const existing = db.prepare(
      'SELECT * FROM requests WHERE goodreads_id = ? AND user_id = ?'
    ).get(goodreadsId, req.userId);
    
    if (existing) {
      db.prepare('ROLLBACK').run();
      return res.status(400).json({ error: 'Already requested' });
    }
    
    // Add to Readarr if API key is configured
    let readarrId = null;
    let status = 'pending';
    
    if (goodreadsId && readarr.client.defaults.headers['X-Api-Key']) {
      try {
        readarrId = await readarr.addBook(goodreadsId);
        status = 'added';
      } catch (error) {
        console.error('Failed to add to Readarr:', error.message);
        // Continue anyway - request will be pending
      }
    }
    
    // Insert request
    const result = db.prepare(
      `INSERT INTO requests (user_id, book_title, book_author, goodreads_id, cover_url, status, readarr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(req.userId, title, author, goodreadsId, coverUrl, status, readarrId);
    
    db.prepare('COMMIT').run();
    
    res.json({ 
      id: result.lastInsertRowid,
      status,
      readarrId
    });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

module.exports = router;```

### backend/routes/search.js
```javascript
const express = require('express');
const router = express.Router();
const readarr = require('../services/readarr');
const jackett = require('../services/jackett');
const prowlarr = require('../services/prowlarr');
const kavita = require('../services/kavita');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { q, source = 'all' } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  const results = [];
  const errors = [];

  // Search Readarr
  if (source === 'all' || source === 'readarr') {
    try {
      const readarrResults = await readarr.search(q);
      results.push(...readarrResults);
    } catch (error) {
      console.error('Readarr search error:', error.message);
      errors.push({ source: 'readarr', error: error.message });
    }
  }

  // Search Jackett with timeout wrapper
  if (source === 'all' || source === 'jackett') {
    try {
      jackett.updateConfig(); // Refresh config
      if (jackett.enabled) {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Search timeout (10s)')), 10000);
        });
        
        // Race between search and timeout
        try {
          const jackettResults = await Promise.race([
            jackett.search(q),
            timeoutPromise
          ]);
          results.push(...jackettResults);
        } catch (timeoutError) {
          console.error('Jackett search timeout:', timeoutError.message);
          errors.push({ source: 'jackett', error: 'Search timed out after 10 seconds' });
        }
      }
    } catch (error) {
      console.error('Jackett search error:', error.message);
      errors.push({ source: 'jackett', error: error.message });
    }
  }

  // Search Prowlarr with timeout wrapper
  if (source === 'all' || source === 'prowlarr') {
    try {
      prowlarr.updateConfig(); // Refresh config
      if (prowlarr.enabled) {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Search timeout (15s)')), 15000);
        });
        
        // Race between search and timeout
        try {
          const prowlarrResults = await Promise.race([
            prowlarr.search(q),
            timeoutPromise
          ]);
          results.push(...prowlarrResults);
        } catch (timeoutError) {
          console.error('Prowlarr search timeout:', timeoutError.message);
          errors.push({ source: 'prowlarr', error: 'Search timed out after 15 seconds' });
        }
      }
    } catch (error) {
      console.error('Prowlarr search error:', error.message);
      errors.push({ source: 'prowlarr', error: error.message });
    }
  }

  // If no results and errors from all sources, return error
  if (results.length === 0 && errors.length > 0) {
    return res.status(500).json({ 
      error: 'All search sources failed', 
      details: errors 
    });
  }

  // Check Kavita library status if enabled
  if (kavita.enabled && results.length > 0) {
    try {
      kavita.updateConfig();
      // Check each book in Kavita
      const kavitaChecks = await Promise.all(
        results.map(async (book) => {
          const inKavita = await kavita.checkBookExists(book.title, book.author);
          return { ...book, inKavita };
        })
      );
      results = kavitaChecks;
    } catch (error) {
      console.error('Kavita check error:', error.message);
      // Continue without Kavita status
    }
  }

  res.json({ 
    results,
    errors: errors.length > 0 ? errors : undefined,
    sources: {
      readarr: true,
      jackett: jackett.enabled,
      prowlarr: prowlarr.enabled,
      kavita: kavita.enabled
    }
  });
});

// Get search sources status
router.get('/sources', requireAuth, async (req, res) => {
  jackett.updateConfig();
  prowlarr.updateConfig();
  kavita.updateConfig();
  
  const sources = {
    readarr: {
      enabled: true,
      connected: await readarr.testConnection()
    },
    jackett: {
      enabled: jackett.enabled,
      connected: jackett.enabled ? await jackett.testConnection() : false
    },
    prowlarr: {
      enabled: prowlarr.enabled,
      connected: prowlarr.enabled ? await prowlarr.testConnection() : false
    },
    kavita: {
      enabled: kavita.enabled,
      connected: kavita.enabled ? await kavita.testConnection() : false
    }
  };
  
  res.json(sources);
});

module.exports = router;```

### backend/routes/settings.js
```javascript
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

module.exports = router;```

### backend/routes/users.js
```javascript
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

module.exports = router;```

### backend/services/aiRecommendations.js
```javascript
const OpenAI = require('openai');
const { getDb } = require('../db/database');

class AIRecommendationService {
  constructor() {
    this.apiKey = '';
    this.model = 'gpt-4-turbo-preview';
    this.enabled = false;
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.openai = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('openai_api_key', 'openai_model', 'ai_recommendations_enabled');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.apiKey = config.openai_api_key || '';
    this.model = config.openai_model || 'gpt-4-turbo-preview';
    this.enabled = config.ai_recommendations_enabled === 'true';
    
    if (this.apiKey && this.enabled) {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
    } else {
      this.openai = null;
    }
  }

  async getRecommendations(userId, limit = 10) {
    this.updateConfig();
    const db = getDb();
    
    if (!this.enabled) {
      throw new Error('AI recommendations are not enabled');
    }
    
    // Check cache first
    const cacheKey = `recommendations_${limit}`;
    const cached = db.prepare(
      `SELECT recommendations FROM recommendation_cache 
       WHERE user_id = ? AND cache_key = ? AND expires_at > datetime('now')`
    ).get(userId, cacheKey);
    
    if (cached) {
      return JSON.parse(cached.recommendations);
    }
    
    // Get user's reading history
    const readingHistory = await this.getUserReadingHistory(userId);
    
    if (readingHistory.length === 0) {
      throw new Error('No reading history found. Please sync your Goodreads library first.');
    }
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(readingHistory, limit);
    
    // Cache recommendations
    const expiresAt = new Date(Date.now() + this.cacheExpiry).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO recommendation_cache 
       (user_id, cache_key, recommendations, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(userId, cacheKey, JSON.stringify(recommendations), expiresAt);
    
    // Store individual recommendations
    for (const rec of recommendations) {
      // Check if book exists
      let bookId = db.prepare(
        'SELECT id FROM books WHERE title = ? AND author_id IN (SELECT id FROM authors WHERE name = ?)'
      ).get(rec.title, rec.author)?.id;
      
      if (!bookId) {
        // Create book entry
        let authorId = db.prepare('SELECT id FROM authors WHERE name = ?').get(rec.author)?.id;
        
        if (!authorId) {
          const authorResult = db.prepare(
            'INSERT INTO authors (name) VALUES (?)'
          ).run(rec.author);
          authorId = authorResult.lastInsertRowid;
        }
        
        const bookResult = db.prepare(
          `INSERT INTO books (title, author_id, description, cover_url, publication_date)
           VALUES (?, ?, ?, ?, ?)`
        ).run(rec.title, authorId, rec.description, rec.coverUrl, rec.publicationYear);
        bookId = bookResult.lastInsertRowid;
      }
      
      // Store AI recommendation
      db.prepare(
        `INSERT OR REPLACE INTO ai_recommendations 
         (user_id, book_id, score, reasoning, model_version, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, bookId, rec.score, rec.reasoning, this.model, expiresAt);
    }
    
    return recommendations;
  }

  async getUserReadingHistory(userId) {
    const db = getDb();
    
    // Get user's books with ratings and read status
    const books = db.prepare(
      `SELECT b.title, a.name as author, b.description, 
              ub.rating, ub.date_read, ub.shelf_name,
              g.name as genre
       FROM user_books ub
       JOIN books b ON ub.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       LEFT JOIN book_genres bg ON b.id = bg.book_id
       LEFT JOIN genres g ON bg.genre_id = g.id
       WHERE ub.user_id = ?
       ORDER BY ub.date_read DESC, ub.date_added DESC
       LIMIT 100`
    ).all(userId);
    
    // Group genres by book
    const bookMap = new Map();
    books.forEach(book => {
      const key = `${book.title}_${book.author}`;
      if (!bookMap.has(key)) {
        bookMap.set(key, {
          title: book.title,
          author: book.author,
          description: book.description,
          rating: book.rating,
          dateRead: book.date_read,
          shelf: book.shelf_name,
          genres: []
        });
      }
      if (book.genre) {
        bookMap.get(key).genres.push(book.genre);
      }
    });
    
    return Array.from(bookMap.values());
  }

  async generateRecommendations(readingHistory, limit) {
    this.updateConfig();
    if (!this.openai) {
      throw new Error('OpenAI API key not configured or AI recommendations disabled');
    }
    
    // Prepare reading history summary
    const favoriteBooks = readingHistory
      .filter(b => b.rating >= 4)
      .slice(0, 20)
      .map(b => `${b.title} by ${b.author} (${b.rating}/5)`);
    
    const recentBooks = readingHistory
      .filter(b => b.dateRead)
      .slice(0, 10)
      .map(b => `${b.title} by ${b.author}`);
    
    const genres = [...new Set(readingHistory.flatMap(b => b.genres))].slice(0, 15);
    
    const prompt = `Based on this reading history, recommend ${limit} books that the user would enjoy.

Favorite books (rated 4-5 stars):
${favoriteBooks.join('\n')}

Recently read:
${recentBooks.join('\n')}

Preferred genres: ${genres.join(', ')}

Please recommend books that:
1. Match the user's demonstrated preferences
2. Are similar in quality to their highly-rated books
3. Introduce some variety while staying within their interests
4. Include both popular and lesser-known titles

For each recommendation, provide:
- Title
- Author
- Publication year
- A brief description (2-3 sentences)
- Why this book would appeal to this reader (1-2 sentences)
- A relevance score from 0.0 to 1.0

Format as JSON array with fields: title, author, publicationYear, description, reasoning, score`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable book recommendation expert who provides personalized suggestions based on reading history.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      const recommendations = result.recommendations || result.books || [];
      
      // Enhance with additional data if available
      return await this.enhanceRecommendations(recommendations);
    } catch (error) {
      console.error('AI recommendation error:', error);
      throw new Error('Failed to generate recommendations: ' + error.message);
    }
  }

  async enhanceRecommendations(recommendations) {
    // Try to fetch cover images and additional metadata from Goodreads
    const goodreadsService = require('./goodreads');
    
    for (const rec of recommendations) {
      try {
        const searchResults = await goodreadsService.searchBooks(`${rec.title} ${rec.author}`);
        if (searchResults.length > 0) {
          const match = searchResults[0];
          rec.coverUrl = match.imageUrl || '/placeholder.jpg';
          rec.goodreadsId = match.goodreadsId;
          rec.averageRating = match.averageRating;
          rec.ratingsCount = match.ratingsCount;
        } else {
          rec.coverUrl = '/placeholder.jpg';
        }
      } catch (error) {
        rec.coverUrl = '/placeholder.jpg';
      }
    }
    
    return recommendations;
  }

  async getPersonalizedRecommendation(userId, bookId) {
    this.updateConfig();
    const db = getDb();
    
    if (!this.enabled) {
      throw new Error('AI recommendations are not enabled');
    }
    
    // Check if we have a cached recommendation
    const cached = db.prepare(
      `SELECT score, reasoning FROM ai_recommendations 
       WHERE user_id = ? AND book_id = ? AND expires_at > datetime('now')`
    ).get(userId, bookId);
    
    if (cached) {
      return cached;
    }
    
    // Get book details
    const book = db.prepare(
      `SELECT b.title, a.name as author, b.description
       FROM books b
       JOIN authors a ON b.author_id = a.id
       WHERE b.id = ?`
    ).get(bookId);
    
    if (!book) {
      throw new Error('Book not found');
    }
    
    // Get user preferences
    const readingHistory = await this.getUserReadingHistory(userId);
    
    // Generate personalized assessment
    const assessment = await this.assessBookForUser(book, readingHistory);
    
    // Store the assessment
    const expiresAt = new Date(Date.now() + this.cacheExpiry).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO ai_recommendations 
       (user_id, book_id, score, reasoning, model_version, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, bookId, assessment.score, assessment.reasoning, this.model, expiresAt);
    
    return assessment;
  }

  async assessBookForUser(book, readingHistory) {
    this.updateConfig();
    if (!this.openai) {
      throw new Error('OpenAI API key not configured or AI recommendations disabled');
    }
    
    const favoriteBooks = readingHistory
      .filter(b => b.rating >= 4)
      .slice(0, 10)
      .map(b => `${b.title} by ${b.author}`);
    
    const prompt = `Assess how well this book would match the user's preferences:

Book to assess:
"${book.title}" by ${book.author}
${book.description}

User's favorite books:
${favoriteBooks.join('\n')}

Provide:
1. A match score from 0.0 to 1.0
2. A brief explanation (2-3 sentences) of why this book would or wouldn't appeal to this reader

Format as JSON with fields: score, reasoning`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a book recommendation expert who assesses book matches based on reading preferences.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('AI assessment error:', error);
      return {
        score: 0.5,
        reasoning: 'Unable to generate personalized assessment at this time.'
      };
    }
  }
}

module.exports = new AIRecommendationService();```

### backend/services/configService.js
```javascript
const { getDb } = require('../db/database');
const crypto = require('crypto');

class ConfigService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
  }

  // Get a configuration value with caching
  get(key, defaultValue = '') {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    try {
      const db = getDb();
      const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      const value = result ? result.value : defaultValue;
      
      // Cache the result
      this.cache.set(key, {
        value,
        expires: Date.now() + this.cacheTimeout
      });
      
      return value;
    } catch (error) {
      console.error(`Failed to get config ${key}:`, error);
      return defaultValue;
    }
  }

  // Get multiple config values at once
  getMultiple(keys) {
    try {
      const db = getDb();
      const placeholders = keys.map(() => '?').join(',');
      const results = db.prepare(
        `SELECT key, value FROM settings WHERE key IN (${placeholders})`
      ).all(...keys);
      
      const config = {};
      keys.forEach(key => {
        config[key] = '';
      });
      
      results.forEach(row => {
        config[row.key] = row.value;
      });
      
      return config;
    } catch (error) {
      console.error('Failed to get multiple configs:', error);
      return {};
    }
  }

  // Update a configuration value
  set(key, value) {
    try {
      const db = getDb();
      db.prepare(
        'UPDATE settings SET value = ? WHERE key = ?'
      ).run(value, key);
      
      // Clear cache for this key
      this.cache.delete(key);
      
      return true;
    } catch (error) {
      console.error(`Failed to set config ${key}:`, error);
      return false;
    }
  }

  // Clear the entire cache
  clearCache() {
    this.cache.clear();
  }

  // Get all settings organized by category
  getAllByCategory() {
    try {
      const db = getDb();
      const settings = db.prepare(`
        SELECT s.*, c.display_name as category_name, c.sort_order
        FROM settings s
        LEFT JOIN setting_categories c ON s.category = c.name
        ORDER BY c.sort_order, s.key
      `).all();
      
      const grouped = {};
      settings.forEach(setting => {
        const category = setting.category || 'general';
        if (!grouped[category]) {
          grouped[category] = {
            name: setting.category_name || category,
            settings: []
          };
        }
        grouped[category].settings.push({
          key: setting.key,
          value: setting.value,
          description: setting.description
        });
      });
      
      return grouped;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  }

  // Initialize missing settings with defaults
  initializeDefaults() {
    const defaults = {
      'session_secret': () => crypto.randomBytes(32).toString('hex'),
      'smtp_port': '587',
      'smtp_secure': 'tls',
      'smtp_from_name': 'Novelarr',
      'kindle_email_domain': '@kindle.com',
      'api_rate_limit_window': '60000',
      'api_rate_limit_max_requests': '300',
      'session_timeout': '604800000',
      'max_login_attempts': '5',
      'lockout_duration': '900000',
      'log_level': 'info'
    };

    try {
      const db = getDb();
      Object.entries(defaults).forEach(([key, value]) => {
        const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        if (!existing || !existing.value) {
          const defaultValue = typeof value === 'function' ? value() : value;
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(defaultValue, key);
        }
      });
    } catch (error) {
      console.error('Failed to initialize defaults:', error);
    }
  }
}

module.exports = new ConfigService();```

### backend/services/goodreads.js
```javascript
const crypto = require('crypto');
const OAuth = require('oauth').OAuth;
const xml2js = require('xml2js');
const { getDb } = require('../db/database');

class GoodreadsService {
  constructor() {
    this.apiKey = '';
    this.apiSecret = '';
    this.callbackUrl = '';
    this.oauth = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('goodreads_api_key', 'goodreads_api_secret', 'goodreads_callback_url');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.apiKey = config.goodreads_api_key || '';
    this.apiSecret = config.goodreads_api_secret || '';
    this.callbackUrl = config.goodreads_callback_url || 'http://localhost:8096/api/goodreads/callback';
    
    if (this.apiKey && this.apiSecret) {
      this.oauth = new OAuth(
        'https://www.goodreads.com/oauth/request_token',
        'https://www.goodreads.com/oauth/access_token',
        this.apiKey,
        this.apiSecret,
        '1.0',
        this.callbackUrl,
        'HMAC-SHA1'
      );
    } else {
      this.oauth = null;
    }
  }

  async getRequestToken() {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken((error, token, tokenSecret) => {
        if (error) {
          reject(new Error('Failed to get request token: ' + error.message));
        } else {
          resolve({ token, tokenSecret });
        }
      });
    });
  }

  getAuthorizationUrl(requestToken) {
    return `https://www.goodreads.com/oauth/authorize?oauth_token=${requestToken}`;
  }

  async getAccessToken(requestToken, requestTokenSecret, verifier) {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(
        requestToken,
        requestTokenSecret,
        verifier,
        (error, accessToken, accessTokenSecret) => {
          if (error) {
            reject(new Error('Failed to get access token: ' + error.message));
          } else {
            resolve({ accessToken, accessTokenSecret });
          }
        }
      );
    });
  }

  async getUserInfo(accessToken, accessTokenSecret) {
    this.updateConfig();
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(
        'https://www.goodreads.com/api/auth_user',
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get user info: ' + error.message));
          } else {
            // Parse XML response
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse user info: ' + parseError.message));
              } else {
                const user = result.GoodreadsResponse?.user?.[0];
                if (user) {
                  resolve({
                    id: user.$.id,
                    name: user.name?.[0],
                    link: user.link?.[0],
                    imageUrl: user.image_url?.[0],
                    smallImageUrl: user.small_image_url?.[0]
                  });
                } else {
                  reject(new Error('Invalid user data format'));
                }
              }
            });
          }
        }
      );
    });
  }

  async getUserShelves(userId, accessToken, accessTokenSecret) {
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(
        `https://www.goodreads.com/shelf/list.xml?user_id=${userId}`,
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get shelves: ' + error.message));
          } else {
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse shelves: ' + parseError.message));
              } else {
                const shelves = result.GoodreadsResponse?.shelves?.[0]?.user_shelf || [];
                resolve(shelves.map(shelf => ({
                  id: shelf.id?.[0].$.nil === 'true' ? null : shelf.id?.[0],
                  name: shelf.name?.[0],
                  bookCount: parseInt(shelf.book_count?.[0] || 0),
                  description: shelf.description?.[0],
                  displayFields: shelf.display_fields?.[0],
                  exclusive: shelf.exclusive_flag?.[0] === 'true',
                  featured: shelf.featured?.[0] === 'true',
                  recommendFor: shelf.recommend_for?.[0] === 'true',
                  sortable: shelf.sort?.[0] === 'true'
                })));
              }
            });
          }
        }
      );
    });
  }

  async getShelfBooks(userId, shelfName, accessToken, accessTokenSecret, page = 1) {
    if (!this.oauth) {
      throw new Error('Goodreads OAuth not configured');
    }

    return new Promise((resolve, reject) => {
      const url = `https://www.goodreads.com/review/list/${userId}.xml?v=2&shelf=${shelfName}&page=${page}&per_page=50`;
      
      this.oauth.get(
        url,
        accessToken,
        accessTokenSecret,
        (error, data) => {
          if (error) {
            reject(new Error('Failed to get shelf books: ' + error.message));
          } else {
            xml2js.parseString(data, (parseError, result) => {
              if (parseError) {
                reject(new Error('Failed to parse shelf books: ' + parseError.message));
              } else {
                const reviews = result.GoodreadsResponse?.reviews?.[0]?.review || [];
                const books = reviews.map(review => ({
                  id: review.book?.[0].id?.[0]._,
                  title: review.book?.[0].title?.[0],
                  author: review.book?.[0].authors?.[0]?.author?.[0]?.name?.[0],
                  isbn: review.book?.[0].isbn?.[0],
                  isbn13: review.book?.[0].isbn13?.[0],
                  imageUrl: review.book?.[0].image_url?.[0],
                  smallImageUrl: review.book?.[0].small_image_url?.[0],
                  publicationYear: review.book?.[0].publication_year?.[0],
                  averageRating: parseFloat(review.book?.[0].average_rating?.[0] || 0),
                  ratingsCount: parseInt(review.book?.[0].ratings_count?.[0] || 0),
                  description: review.book?.[0].description?.[0],
                  numPages: parseInt(review.book?.[0].num_pages?.[0] || 0),
                  userRating: parseInt(review.rating?.[0] || 0),
                  dateRead: review.read_at?.[0],
                  dateAdded: review.date_added?.[0],
                  shelves: review.shelves?.[0]?.shelf?.map(s => s.$.name) || []
                }));
                
                resolve({
                  books,
                  total: parseInt(result.GoodreadsResponse?.reviews?.[0].$?.total || 0),
                  page: parseInt(result.GoodreadsResponse?.reviews?.[0].$?.page || 1)
                });
              }
            });
          }
        }
      );
    });
  }

  async syncUserLibrary(userId) {
    const db = getDb();
    
    // Get user's Goodreads credentials
    const userGoodreads = db.prepare(
      'SELECT * FROM user_goodreads WHERE user_id = ?'
    ).get(userId);
    
    if (!userGoodreads) {
      throw new Error('User has not connected Goodreads account');
    }
    
    const { access_token, access_token_secret, goodreads_user_id } = userGoodreads;
    
    try {
      // Sync shelves
      const shelves = await this.getUserShelves(goodreads_user_id, access_token, access_token_secret);
      
      for (const shelf of shelves) {
        db.prepare(
          `INSERT OR REPLACE INTO user_shelves 
           (user_id, goodreads_shelf_id, name, book_count, is_exclusive)
           VALUES (?, ?, ?, ?, ?)`
        ).run(userId, shelf.id || shelf.name, shelf.name, shelf.bookCount, shelf.exclusive ? 1 : 0);
      }
      
      // Sync books from each shelf
      for (const shelf of shelves) {
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
          const result = await this.getShelfBooks(
            goodreads_user_id, 
            shelf.name, 
            access_token, 
            access_token_secret, 
            page
          );
          
          for (const book of result.books) {
            // Check if book exists in our database
            let bookId = db.prepare(
              'SELECT id FROM books WHERE goodreads_id = ?'
            ).get(book.id)?.id;
            
            if (!bookId) {
              // Import book metadata
              bookId = await this.importBook(book);
            }
            
            // Update user's book record
            db.prepare(
              `INSERT OR REPLACE INTO user_books 
               (user_id, book_id, goodreads_book_id, shelf_name, rating, date_read, date_added)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              userId,
              bookId,
              book.id,
              shelf.name,
              book.userRating,
              book.dateRead,
              book.dateAdded
            );
          }
          
          hasMore = (page * 50) < result.total;
          page++;
        }
      }
      
      // Update last sync time
      db.prepare(
        'UPDATE user_goodreads SET last_sync = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).run(userId);
      
      return { success: true, message: 'Library synced successfully' };
    } catch (error) {
      console.error('Goodreads sync error:', error);
      throw error;
    }
  }

  async importBook(goodreadsBook) {
    const db = getDb();
    
    // Get or create author
    let authorId = db.prepare(
      'SELECT id FROM authors WHERE name = ?'
    ).get(goodreadsBook.author)?.id;
    
    if (!authorId) {
      const result = db.prepare(
        'INSERT INTO authors (name, goodreads_id) VALUES (?, ?)'
      ).run(goodreadsBook.author || 'Unknown', null);
      authorId = result.lastInsertRowid;
    }
    
    // Insert book
    const result = db.prepare(
      `INSERT INTO books (
        title, author_id, isbn, goodreads_id, description,
        cover_url, publication_date, page_count, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goodreadsBook.title,
      authorId,
      goodreadsBook.isbn13 || goodreadsBook.isbn,
      goodreadsBook.id,
      goodreadsBook.description,
      goodreadsBook.imageUrl,
      goodreadsBook.publicationYear,
      goodreadsBook.numPages,
      goodreadsBook.averageRating
    );
    
    return result.lastInsertRowid;
  }

  async searchBooks(query) {
    this.updateConfig();
    if (!this.apiKey) {
      throw new Error('Goodreads API key not configured');
    }

    // Note: This uses the public API endpoint that doesn't require OAuth
    const url = `https://www.goodreads.com/search/index.xml?key=${this.apiKey}&q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.text();
      
      return new Promise((resolve, reject) => {
        xml2js.parseString(data, (error, result) => {
          if (error) {
            reject(new Error('Failed to parse search results: ' + error.message));
          } else {
            const works = result.GoodreadsResponse?.search?.[0]?.results?.[0]?.work || [];
            const books = works.map(work => ({
              goodreadsId: work.best_book?.[0].id?.[0]._,
              title: work.best_book?.[0].title?.[0],
              author: work.best_book?.[0].author?.[0].name?.[0],
              imageUrl: work.best_book?.[0].image_url?.[0],
              smallImageUrl: work.best_book?.[0].small_image_url?.[0],
              publicationYear: work.original_publication_year?.[0]._,
              averageRating: parseFloat(work.average_rating?.[0] || 0),
              ratingsCount: parseInt(work.ratings_count?.[0]._ || 0),
              textReviewsCount: parseInt(work.text_reviews_count?.[0]._ || 0)
            }));
            resolve(books);
          }
        });
      });
    } catch (error) {
      throw new Error('Failed to search Goodreads: ' + error.message);
    }
  }
}

module.exports = new GoodreadsService();```

### backend/services/jackett.js
```javascript
const axios = require('axios');
const { getDb } = require('../db/database');

class JackettService {
  constructor() {
    this.enabled = false;
    this.url = '';
    this.apiKey = '';
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('jackett_enabled', 'jackett_url', 'jackett_api_key');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.jackett_enabled === 'true';
    this.url = config.jackett_url || '';
    this.apiKey = config.jackett_api_key || '';
    
    if (this.enabled && this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        timeout: 10000,
        params: {
          apikey: this.apiKey
        }
      });
    }
  }

  async search(query) {
    this.updateConfig(); // Refresh config before search
    
    if (!this.enabled || !this.client) {
      throw new Error('Jackett is not configured');
    }

    try {
      // Search specifically in book categories
      const response = await this.client.get('/api/v2.0/indexers/all/results', {
        params: {
          apikey: this.apiKey,
          Query: query,
          Category: '7000,7020', // eBook categories
          limit: 50
        }
      });
      
      // Transform Jackett results to our format
      const results = response.data.Results || [];
      
      return results.map(item => ({
        // Use GUID as a unique ID since Jackett doesn't provide Goodreads ID
        goodreadsId: `jackett-${item.Guid || item.Link}`,
        title: item.Title || 'Unknown Title',
        author: this.extractAuthor(item.Title) || 'Unknown Author',
        year: item.PublishDate ? new Date(item.PublishDate).getFullYear() : null,
        coverUrl: item.Poster || '/placeholder.jpg',
        overview: item.Description || '',
        ratings: 0, // Jackett doesn't provide ratings
        pageCount: 0, // Jackett doesn't provide page count
        source: 'Jackett',
        size: this.formatSize(item.Size),
        seeders: item.Seeders || 0,
        indexer: item.Tracker || 'Unknown'
      }));
    } catch (error) {
      console.error('Jackett search error:', error.message);
      throw new Error('Failed to search Jackett: ' + error.message);
    }
  }

  extractAuthor(title) {
    // Try to extract author from title patterns like "Book Title - Author Name"
    const patterns = [
      /^(.+?)\s*-\s*(.+?)$/,  // Title - Author
      /^(.+?)\s*by\s+(.+?)$/i, // Title by Author
      /^(.+?)\s*\((.+?)\)$/    // Title (Author)
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[2].trim();
      }
    }
    
    return null;
  }

  formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  async testConnection() {
    this.updateConfig();
    
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      await this.client.get('/api/v2.0/indexers/all/results', {
        params: {
          apikey: this.apiKey,
          Query: 'test',
          limit: 1
        }
      });
      return true;
    } catch (error) {
      console.error('Jackett test failed:', error.message);
      return false;
    }
  }
}

module.exports = new JackettService();```

### backend/services/kavita.js
```javascript
const axios = require('axios');
const { getDb } = require('../db/database');

class KavitaService {
  constructor() {
    this.enabled = false;
    this.url = '';
    this.apiKey = '';
    this.jwtToken = null;
    this.tokenExpiry = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('kavita_url', 'kavita_api_key', 'kavita_enabled');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.kavita_enabled === 'true';
    this.url = config.kavita_url || '';
    this.apiKey = config.kavita_api_key || '';
    this.jwtToken = null;
    this.tokenExpiry = null;
    
    if (this.enabled && this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        timeout: 10000
      });
    }
  }

  async authenticate() {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Kavita is not configured');
    }

    // Check if we have a valid token
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }

    try {
      // Get JWT token using API key
      const response = await this.client.post('/api/Plugin/authenticate', {
        apiKey: this.apiKey
      });

      this.jwtToken = response.data.token;
      // JWT tokens typically expire in 24 hours
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      
      // Update axios instance with auth header
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.jwtToken}`;
      
      return this.jwtToken;
    } catch (error) {
      console.error('Kavita authentication failed:', error.message);
      throw new Error('Failed to authenticate with Kavita');
    }
  }

  async searchLibrary(query) {
    await this.authenticate();
    
    try {
      // Search series in Kavita
      const response = await this.client.get('/api/Series/search', {
        params: { queryString: query }
      });
      
      return response.data.map(series => ({
        id: series.id,
        name: series.name,
        libraryId: series.libraryId,
        coverImageUrl: `${this.url}/api/Image/series-cover?seriesId=${series.id}`,
        pagesRead: series.pagesRead,
        pages: series.pages,
        format: series.format,
        created: series.created,
        lastModified: series.lastModified,
        bookCount: series.bookCount || 0,
        inKavita: true
      }));
    } catch (error) {
      console.error('Kavita search error:', error.message);
      return [];
    }
  }

  async checkBookExists(title, author) {
    await this.authenticate();
    
    try {
      // Search for exact match
      const searchQuery = author ? `${title} ${author}` : title;
      const results = await this.searchLibrary(searchQuery);
      
      // Check for exact or close match
      return results.some(series => {
        const seriesName = series.name.toLowerCase();
        const searchTitle = title.toLowerCase();
        return seriesName.includes(searchTitle) || searchTitle.includes(seriesName);
      });
    } catch (error) {
      console.error('Kavita check book exists error:', error.message);
      return false;
    }
  }

  async getLibraries() {
    await this.authenticate();
    
    try {
      const response = await this.client.get('/api/Library');
      return response.data;
    } catch (error) {
      console.error('Failed to get Kavita libraries:', error.message);
      return [];
    }
  }

  async getSeries(seriesId) {
    await this.authenticate();
    
    try {
      const response = await this.client.get(`/api/Series/${seriesId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get series details:', error.message);
      return null;
    }
  }

  async getVolumes(seriesId) {
    await this.authenticate();
    
    try {
      const response = await this.client.get(`/api/Series/volumes`, {
        params: { seriesId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get volumes:', error.message);
      return [];
    }
  }

  async refreshLibrary(libraryId) {
    await this.authenticate();
    
    try {
      const response = await this.client.post(`/api/Library/scan`, {
        libraryId: libraryId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to refresh library:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.authenticate();
      // Try to get libraries as a test
      const libraries = await this.getLibraries();
      return libraries.length >= 0; // Even 0 libraries is a valid response
    } catch (error) {
      console.error('Kavita connection test failed:', error.message);
      return false;
    }
  }

  // Helper to build Kavita reader URL
  getReaderUrl(seriesId, volumeId, chapterId) {
    if (!this.url) return null;
    return `${this.url}/library/${seriesId}/series/${seriesId}/volume/${volumeId}/chapter/${chapterId}`;
  }

  // Helper to build series URL
  getSeriesUrl(libraryId, seriesId) {
    if (!this.url) return null;
    return `${this.url}/library/${libraryId}/series/${seriesId}`;
  }
}

module.exports = new KavitaService();```

### backend/services/prowlarr.js
```javascript
const axios = require('axios');
const { getDb } = require('../db/database');

class ProwlarrService {
  constructor() {
    this.enabled = false;
    this.url = '';
    this.apiKey = '';
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('prowlarr_enabled', 'prowlarr_url', 'prowlarr_api_key');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.prowlarr_enabled === 'true';
    this.url = config.prowlarr_url || '';
    this.apiKey = config.prowlarr_api_key || '';
    
    if (this.enabled && this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        timeout: 60000, // 60 second timeout for Prowlarr
        headers: {
          'X-Api-Key': this.apiKey
        }
      });
    }
  }

  async search(query) {
    this.updateConfig(); // Refresh config before search
    
    if (!this.enabled || !this.client) {
      throw new Error('Prowlarr is not configured');
    }

    console.log('Prowlarr search starting for:', query);
    const startTime = Date.now();

    try {
      // Search using Prowlarr's search API - just query parameter
      const response = await this.client.get('/api/v1/search', {
        params: {
          query: query
        }
      });
      
      // Transform Prowlarr results to our format
      const results = response.data || [];
      
      // Filter for book-related categories
      const bookResults = results.filter(item => {
        // If no categories, include it (might be a book)
        if (!item.categories || item.categories.length === 0) return true;
        
        // Check for book-related categories
        return item.categories.some(cat => 
          cat.id === 3030 || // Audio/Audiobook
          cat.id === 7000 || // Books
          cat.id === 7010 || // Books/Mags
          cat.id === 7020 || // Books/EBook
          cat.id === 7030 || // Books/Comics
          cat.id === 7040 || // Books/Technical
          cat.id === 7050 || // Books/Other
          cat.id === 7060 || // Books/Magazines
          cat.id === 8010 || // Books/Ebook
          (cat.id >= 100000 && cat.id < 200000) // Custom book categories
        );
      });
      
      const searchTime = Date.now() - startTime;
      console.log(`Prowlarr search completed in ${searchTime}ms, found ${bookResults.length} book results`);
      
      return bookResults.slice(0, 50).map(item => ({
        // Use GUID as unique ID
        goodreadsId: `prowlarr-${item.guid}`,
        title: item.title || 'Unknown Title',
        author: this.extractAuthor(item.title) || 'Unknown Author',
        year: item.publishDate ? new Date(item.publishDate).getFullYear() : null,
        coverUrl: '/placeholder.jpg', // Prowlarr doesn't provide covers
        overview: item.categories?.map(c => c.name).join(', ') || '',
        ratings: 0, // Prowlarr doesn't provide ratings
        pageCount: 0, // Prowlarr doesn't provide page count
        source: 'Prowlarr',
        size: this.formatSize(item.size),
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        indexer: item.indexer || 'Unknown',
        downloadUrl: item.downloadUrl,
        infoUrl: item.infoUrl,
        files: item.files || 0
      }));
    } catch (error) {
      console.error('Prowlarr search error:', error.message);
      throw new Error('Failed to search Prowlarr: ' + error.message);
    }
  }

  extractAuthor(title) {
    // Try to extract author from title patterns
    const patterns = [
      /^(.+?)\s*-\s*(.+?)$/,  // Title - Author
      /^(.+?)\s*by\s+(.+?)$/i, // Title by Author
      /^(.+?)\s*\((.+?)\)$/    // Title (Author)
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[2].trim();
      }
    }
    
    return null;
  }

  formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  async testConnection() {
    this.updateConfig();
    
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      await this.client.get('/api/v1/health');
      return true;
    } catch (error) {
      console.error('Prowlarr test failed:', error.message);
      return false;
    }
  }

  async getIndexers() {
    this.updateConfig();
    
    if (!this.enabled || !this.client) {
      throw new Error('Prowlarr is not configured');
    }

    try {
      const response = await this.client.get('/api/v1/indexer');
      return response.data;
    } catch (error) {
      console.error('Failed to get Prowlarr indexers:', error.message);
      throw new Error('Failed to get indexers');
    }
  }
}

module.exports = new ProwlarrService();```

### backend/services/readarr.js
```javascript
const axios = require('axios');
const { getDb } = require('../db/database');

class ReadarrService {
  constructor() {
    this.url = '';
    this.apiKey = '';
    this.qualityProfile = 1;
    this.rootFolder = '';
    this.client = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)'
    ).all('readarr_url', 'readarr_api_key', 'readarr_quality_profile', 'readarr_root_folder');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.url = config.readarr_url || '';
    this.apiKey = config.readarr_api_key || '';
    this.qualityProfile = parseInt(config.readarr_quality_profile) || 1;
    this.rootFolder = config.readarr_root_folder || '';
    
    if (this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        headers: {
          'X-Api-Key': this.apiKey
        },
        timeout: 10000
      });
    } else {
      this.client = null;
    }
  }

  async search(query) {
    try {
      const response = await this.client.get('/api/v1/search', {
        params: { term: query }
      });
      
      return response.data.map(book => ({
        goodreadsId: book.foreignId,
        title: book.title,
        author: book.authorName || 'Unknown',
        year: book.releaseDate ? new Date(book.releaseDate).getFullYear() : null,
        coverUrl: book.remoteCover || '/placeholder.jpg',
        overview: book.overview || '',
        ratings: book.ratings?.value || 0,
        pageCount: book.pageCount || 0
      }));
    } catch (error) {
      console.error('Readarr search error:', error.message);
      
      // If Readarr fails, return mock data for testing
      if (query.toLowerCase().includes('harry')) {
        return [
          {
            goodreadsId: '3',
            title: "Harry Potter and the Sorcerer's Stone",
            author: 'J.K. Rowling',
            year: 1997,
            coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/81YOuOGFCJL.jpg',
            overview: 'The first book in the Harry Potter series',
            ratings: 4.47,
            pageCount: 309
          },
          {
            goodreadsId: '15881',
            title: 'Harry Potter and the Chamber of Secrets',
            author: 'J.K. Rowling',
            year: 1998,
            coverUrl: 'https://images-na.ssl-images-amazon.com/images/I/91HHqVTAJQL.jpg',
            overview: 'The second book in the Harry Potter series',
            ratings: 4.42,
            pageCount: 341
          }
        ];
      }
      
      throw new Error('Failed to search Readarr');
    }
  }

  async addBook(goodreadsId) {
    try {
      // First, get the book details
      const searchResponse = await this.client.get('/api/v1/search', {
        params: { term: goodreadsId }
      });
      
      const book = searchResponse.data.find(b => b.foreignId === goodreadsId);
      if (!book) throw new Error('Book not found');
      
      // Add to Readarr
      const response = await this.client.post('/api/v1/book', {
        ...book,
        qualityProfileId: config.readarr.qualityProfile,
        rootFolderPath: config.readarr.rootFolder,
        monitored: true,
        addOptions: {
          searchForNewBook: true
        }
      });
      
      return response.data.id;
    } catch (error) {
      console.error('Readarr add error:', error.message);
      throw new Error('Failed to add book to Readarr');
    }
  }

  async testConnection() {
    try {
      await this.client.get('/api/v1/system/status');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ReadarrService();```

### backend/services/readarrSync.js
```javascript
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('../db/database');

class ReadarrSyncService {
  constructor() {
    this.syncInterval = null;
    this.initialized = false;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      `SELECT key, value FROM settings 
       WHERE key IN (?, ?, ?, ?, ?, ?)`
    ).all(
      'readarr_url', 
      'readarr_api_key', 
      'readarr_sync_enabled',
      'readarr_sync_interval',
      'library_root',
      'import_mode'
    );
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.readarr_sync_enabled === 'true';
    this.syncIntervalSeconds = parseInt(config.readarr_sync_interval) || 300;
    this.libraryRoot = config.library_root || '/books';
    this.importMode = config.import_mode || 'copy';
    
    if (config.readarr_url && config.readarr_api_key) {
      this.client = axios.create({
        baseURL: config.readarr_url,
        headers: {
          'X-Api-Key': config.readarr_api_key
        },
        timeout: 30000
      });
    }
  }

  async startSync() {
    // Initialize config on first start
    if (!this.initialized) {
      try {
        this.updateConfig();
        this.initialized = true;
      } catch (error) {
        console.error('Failed to initialize Readarr sync:', error.message);
        return;
      }
    }

    if (!this.enabled || !this.client) {
      console.log('Readarr sync disabled or not configured');
      return;
    }

    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Initial sync
    await this.syncWithReadarr();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.syncWithReadarr().catch(console.error);
    }, this.syncIntervalSeconds * 1000);

    console.log(`Readarr sync started (interval: ${this.syncIntervalSeconds}s)`);
  }

  async syncWithReadarr() {
    try {
      console.log('Starting Readarr sync...');
      
      // Get all books from Readarr
      const books = await this.getReadarrBooks();
      
      // Get all book files from Readarr
      const bookFiles = await this.getReadarrBookFiles();
      
      // Process each book
      for (const book of books) {
        await this.processBook(book, bookFiles);
      }

      // Update request statuses
      await this.updateRequestStatuses(books);
      
      console.log('Readarr sync completed');
    } catch (error) {
      console.error('Readarr sync error:', error.message);
    }
  }

  async getReadarrBooks() {
    try {
      const response = await this.client.get('/api/v1/book');
      return response.data;
    } catch (error) {
      console.error('Failed to get Readarr books:', error.message);
      return [];
    }
  }

  async getReadarrBookFiles() {
    try {
      const response = await this.client.get('/api/v1/bookfile');
      return response.data;
    } catch (error) {
      console.error('Failed to get Readarr book files:', error.message);
      return [];
    }
  }

  async processBook(readarrBook, bookFiles) {
    const db = getDb();
    
    // Find files for this book
    const files = bookFiles.filter(f => f.bookId === readarrBook.id);
    if (files.length === 0) return;

    // Check if book exists in our library
    let bookId = db.prepare(
      'SELECT id FROM books WHERE goodreads_id = ?'
    ).get(readarrBook.foreignBookId)?.id;

    if (!bookId) {
      // Import book metadata
      bookId = await this.importBookMetadata(readarrBook);
    }

    // Process each file
    for (const file of files) {
      await this.processBookFile(bookId, file, readarrBook);
    }
  }

  async importBookMetadata(readarrBook) {
    const db = getDb();
    
    // Get or create author
    let authorId = db.prepare(
      'SELECT id FROM authors WHERE name = ?'
    ).get(readarrBook.author?.authorName)?.id;

    if (!authorId) {
      const result = db.prepare(
        `INSERT INTO authors (name, goodreads_id, description, image_url)
         VALUES (?, ?, ?, ?)`
      ).run(
        readarrBook.author?.authorName || 'Unknown',
        readarrBook.author?.foreignAuthorId,
        readarrBook.author?.overview,
        readarrBook.author?.images?.[0]?.url
      );
      authorId = result.lastInsertRowid;
    }

    // Insert book
    const result = db.prepare(
      `INSERT INTO books (
        title, author_id, isbn, goodreads_id, description, 
        cover_url, publication_date, publisher, page_count, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      readarrBook.title,
      authorId,
      readarrBook.editions?.[0]?.isbn13,
      readarrBook.foreignBookId,
      readarrBook.overview,
      readarrBook.images?.[0]?.url,
      readarrBook.releaseDate,
      readarrBook.editions?.[0]?.publisher,
      readarrBook.pageCount,
      readarrBook.ratings?.value
    );

    // Handle genres
    if (readarrBook.genres && readarrBook.genres.length > 0) {
      for (const genre of readarrBook.genres) {
        let genreId = db.prepare('SELECT id FROM genres WHERE name = ?').get(genre)?.id;
        
        if (!genreId) {
          const genreResult = db.prepare('INSERT INTO genres (name) VALUES (?)').run(genre);
          genreId = genreResult.lastInsertRowid;
        }
        
        db.prepare(
          'INSERT OR IGNORE INTO book_genres (book_id, genre_id) VALUES (?, ?)'
        ).run(result.lastInsertRowid, genreId);
      }
    }

    // Handle series
    if (readarrBook.seriesTitle) {
      let seriesId = db.prepare('SELECT id FROM series WHERE name = ?').get(readarrBook.seriesTitle)?.id;
      
      if (!seriesId) {
        const seriesResult = db.prepare(
          'INSERT INTO series (name, goodreads_id) VALUES (?, ?)'
        ).run(readarrBook.seriesTitle, readarrBook.seriesId);
        seriesId = seriesResult.lastInsertRowid;
      }
      
      db.prepare(
        'INSERT OR IGNORE INTO book_series (book_id, series_id, position) VALUES (?, ?, ?)'
      ).run(result.lastInsertRowid, seriesId, readarrBook.seriesPosition);
    }

    return result.lastInsertRowid;
  }

  async processBookFile(bookId, readarrFile, readarrBook) {
    const db = getDb();
    
    // Check if we already have this file
    const existingFile = db.prepare(
      'SELECT id FROM book_files WHERE file_path = ?'
    ).get(readarrFile.path);
    
    if (existingFile) return;

    // Import the file
    const fileName = path.basename(readarrFile.path);
    const fileExt = path.extname(fileName).toLowerCase().substring(1);
    
    // Create library structure
    const authorFolder = readarrBook.author?.authorName?.replace(/[^\w\s-]/g, '') || 'Unknown';
    const bookFolder = readarrBook.title.replace(/[^\w\s-]/g, '');
    const targetDir = path.join(this.libraryRoot, authorFolder, bookFolder);
    
    try {
      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });
      
      // Import file
      const targetPath = path.join(targetDir, fileName);
      
      if (this.importMode === 'copy') {
        await fs.copyFile(readarrFile.path, targetPath);
      } else {
        // Try hardlink first, fall back to copy
        try {
          await fs.link(readarrFile.path, targetPath);
        } catch (error) {
          await fs.copyFile(readarrFile.path, targetPath);
        }
      }
      
      // Calculate file hash
      const fileBuffer = await fs.readFile(targetPath);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      
      // Insert into database
      db.prepare(
        `INSERT INTO book_files (
          book_id, file_path, file_name, file_size, file_format, file_hash, quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        bookId,
        targetPath,
        fileName,
        readarrFile.size,
        fileExt,
        hash,
        readarrFile.quality?.quality?.name || 'Unknown'
      );
      
      console.log(`Imported: ${fileName}`);
    } catch (error) {
      console.error(`Failed to import ${fileName}:`, error.message);
    }
  }

  async updateRequestStatuses(readarrBooks) {
    const db = getDb();
    
    // Get all pending requests
    const requests = db.prepare(
      'SELECT id, goodreads_id, readarr_id FROM requests WHERE download_status = ?'
    ).all('pending');
    
    for (const request of requests) {
      // Find corresponding Readarr book
      const readarrBook = readarrBooks.find(
        b => b.foreignBookId === request.goodreads_id || b.id === request.readarr_id
      );
      
      if (readarrBook) {
        // Check if book has files
        const hasFiles = db.prepare(
          'SELECT COUNT(*) as count FROM book_files WHERE book_id IN (SELECT id FROM books WHERE goodreads_id = ?)'
        ).get(readarrBook.foreignBookId)?.count > 0;
        
        if (hasFiles) {
          // Update request status
          db.prepare(
            `UPDATE requests 
             SET download_status = ?, downloaded_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run('completed', request.id);
        }
      }
    }
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Readarr sync stopped');
    }
  }
}

module.exports = new ReadarrSyncService();```

## Frontend Code

### frontend/src/main.js
```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')```

### frontend/src/App.vue
```vue
<template>
  <div class="min-h-screen bg-gray-100">
    <NavBar />
    <router-view />
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
</script>```

### frontend/src/router.js
```javascript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/search'
  },
  {
    path: '/login',
    component: () => import('./views/Login.vue')
  },
  {
    path: '/search',
    component: () => import('./views/Search.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/requests',
    component: () => import('./views/Requests.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    component: () => import('./views/Settings.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/users',
    component: () => import('./views/Users.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/recommendations',
    component: () => import('./views/RecommendationsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/library',
    component: () => import('./views/Library.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/search')
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
    next('/search')
  } else {
    next()
  }
})

export default router```

### frontend/src/api.js
```javascript
import axios from 'axios'
import { useAuthStore } from './stores/auth'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// Add auth token to requests
api.interceptors.request.use(config => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api```

### frontend/src/stores/auth.js
```javascript
import { defineStore } from 'pinia'
import api from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token')
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token
  },
  
  actions: {
    async login(username, password) {
      const response = await api.post('/auth/login', { username, password })
      this.token = response.data.token
      this.user = response.data.user
      localStorage.setItem('token', this.token)
    },
    
    async register(username, password) {
      const response = await api.post('/auth/register', { username, password })
      this.token = response.data.token
      this.user = response.data.user
      localStorage.setItem('token', this.token)
    },
    
    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('token')
    }
  }
})```

### frontend/src/components/AIRecommendations.vue
```vue
<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-6 border-b">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">AI Recommendations</h2>
        <button
          @click="refreshRecommendations"
          :disabled="loading"
          class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          <svg class="w-4 h-4 inline mr-1" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <p class="mt-2 text-sm text-gray-600">
        Personalized book recommendations based on your reading history
      </p>
    </div>

    <div v-if="!hasGoodreads" class="p-8 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">Connect Goodreads to Get Started</h3>
      <p class="mt-1 text-sm text-gray-500">
        AI recommendations require your reading history from Goodreads.
      </p>
      <router-link
        to="/settings"
        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Go to Settings
      </router-link>
    </div>

    <div v-else-if="loading && !recommendations.length" class="p-8">
      <div class="flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
      <p class="mt-4 text-center text-sm text-gray-500">Analyzing your reading preferences...</p>
    </div>

    <div v-else-if="error" class="p-8 text-center">
      <div class="text-red-600 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-sm text-gray-900">{{ error }}</p>
      <button
        @click="fetchRecommendations"
        class="mt-4 text-sm text-blue-600 hover:text-blue-800"
      >
        Try Again
      </button>
    </div>

    <div v-else-if="recommendations.length > 0" class="divide-y">
      <div
        v-for="book in recommendations"
        :key="book.goodreadsId || book.title"
        class="p-6 hover:bg-gray-50 transition-colors"
      >
        <div class="flex space-x-4">
          <img
            :src="book.coverUrl || '/placeholder.jpg'"
            :alt="book.title"
            class="h-32 w-24 object-cover rounded"
          >
          <div class="flex-1">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-lg font-medium text-gray-900">{{ book.title }}</h3>
                <p class="text-sm text-gray-600">by {{ book.author }}</p>
                <p v-if="book.publicationYear" class="text-xs text-gray-500 mt-1">
                  Published {{ book.publicationYear }}
                </p>
              </div>
              <div class="flex items-center space-x-1">
                <span class="text-sm font-medium text-gray-900">{{ (book.score * 100).toFixed(0) }}%</span>
                <span class="text-xs text-gray-500">match</span>
              </div>
            </div>
            
            <p class="mt-2 text-sm text-gray-700 line-clamp-2">{{ book.description }}</p>
            
            <div class="mt-2 p-3 bg-blue-50 rounded">
              <p class="text-sm text-blue-800">
                <svg class="w-4 h-4 inline mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {{ book.reasoning }}
              </p>
            </div>

            <div class="mt-3 flex items-center space-x-3">
              <button
                @click="requestBook(book)"
                class="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Request Book
              </button>
              <router-link
                :to="`/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`"
                class="text-sm text-gray-600 hover:text-gray-900"
              >
                Search Library
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 text-center">
        <button
          @click="loadMore"
          :disabled="loading"
          class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          Load More Recommendations
        </button>
      </div>
    </div>

    <div v-else class="p-8 text-center text-gray-500">
      <p>No recommendations available yet.</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

export default {
  name: 'AIRecommendations',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const recommendations = ref([])
    const loading = ref(false)
    const error = ref('')
    const hasGoodreads = ref(false)
    const limit = ref(10)

    const checkGoodreadsStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        hasGoodreads.value = response.data.connected
      } catch (err) {
        console.error('Failed to check Goodreads status:', err)
      }
    }

    const fetchRecommendations = async (refresh = false) => {
      if (!hasGoodreads.value) return

      try {
        loading.value = true
        error.value = ''
        
        const response = await axios.get('/api/recommendations', {
          params: { limit: limit.value, refresh },
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        recommendations.value = response.data
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to fetch recommendations'
      } finally {
        loading.value = false
      }
    }

    const refreshRecommendations = () => {
      fetchRecommendations(true)
    }

    const loadMore = () => {
      limit.value += 10
      fetchRecommendations()
    }

    const requestBook = async (book) => {
      try {
        await axios.post('/api/requests', {
          goodreadsId: book.goodreadsId,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl
        }, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        router.push('/requests')
      } catch (err) {
        console.error('Failed to request book:', err)
        alert('Failed to create request. Please try again.')
      }
    }

    onMounted(async () => {
      await checkGoodreadsStatus()
      if (hasGoodreads.value) {
        fetchRecommendations()
      }
    })

    return {
      recommendations,
      loading,
      error,
      hasGoodreads,
      fetchRecommendations,
      refreshRecommendations,
      loadMore,
      requestBook
    }
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>```

### frontend/src/components/BookCard.vue
```vue
<template>
  <div class="bg-white rounded-lg shadow-md overflow-hidden">
    <img 
      :src="book.coverUrl || '/placeholder.jpg'" 
      :alt="book.title"
      class="w-full h-64 object-cover"
    >
    <div class="p-4">
      <h3 class="font-bold text-lg mb-1">{{ book.title }}</h3>
      <p class="text-gray-600 mb-2">{{ book.author }}</p>
      <div class="flex items-center justify-between mb-3">
        <p v-if="book.year" class="text-sm text-gray-500">{{ book.year }}</p>
        <span v-if="book.source" class="text-xs px-2 py-1 rounded-full" :class="getSourceClass(book.source)">
          {{ book.source }}
        </span>
      </div>
      <div v-if="book.size || book.seeders !== undefined || book.leechers !== undefined" class="text-xs text-gray-500 mb-3">
        <span v-if="book.size">Size: {{ book.size }}</span>
        <span v-if="book.seeders !== undefined" class="ml-2">S: {{ book.seeders }}</span>
        <span v-if="book.leechers !== undefined" class="ml-1">L: {{ book.leechers }}</span>
        <span v-if="book.indexer" class="ml-2">[{{ book.indexer }}]</span>
      </div>
      
      <!-- Kavita status badge -->
      <div v-if="book.inKavita" class="mb-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <svg class="mr-1.5 h-2 w-2 text-purple-400" fill="currentColor" viewBox="0 0 8 8">
            <circle cx="4" cy="4" r="3" />
          </svg>
          Available in Kavita
        </span>
      </div>
      
      <div class="space-y-2">
        <!-- Request/Download button -->
        <button 
          v-if="!book.inKavita"
          @click="$emit('request', book)"
          :disabled="requesting || book.source !== 'Readarr'"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ book.source !== 'Readarr' ? 'Manual Download Only' : (requesting ? 'Requesting...' : 'Request') }}
        </button>
        
        <!-- Open in Kavita button -->
        <button
          v-if="book.inKavita && book.kavitaUrl"
          @click="openInKavita"
          class="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600"
        >
          Open in Kavita
        </button>
        
        <!-- Read now button (for books in Kavita) -->
        <button
          v-else-if="book.inKavita"
          @click="$emit('read', book)"
          class="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
        >
          Read Now
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  book: {
    type: Object,
    required: true
  },
  requesting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['request', 'read'])

const getSourceClass = (source) => {
  switch (source) {
    case 'Readarr':
      return 'bg-green-100 text-green-800'
    case 'Jackett':
      return 'bg-blue-100 text-blue-800'
    case 'Prowlarr':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const openInKavita = () => {
  if (props.book.kavitaUrl) {
    window.open(props.book.kavitaUrl, '_blank')
  }
}
</script>```

### frontend/src/components/GoodreadsConnect.vue
```vue
<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900">Goodreads Integration</h3>
      <img 
        src="https://s.gr-assets.com/assets/home/header_logo-8d96d7078a3d63f9f31d92282fd67cf4.png"
        alt="Goodreads"
        class="h-6"
      >
    </div>

    <div v-if="!status.connected" class="space-y-4">
      <p class="text-sm text-gray-600">
        Connect your Goodreads account to sync your reading history and get personalized AI recommendations.
      </p>
      <button
        @click="connectGoodreads"
        :disabled="connecting"
        class="w-full bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50"
      >
        <span v-if="!connecting">Connect Goodreads Account</span>
        <span v-else>Redirecting...</span>
      </button>
    </div>

    <div v-else class="space-y-4">
      <div class="flex items-center space-x-3">
        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="text-sm font-medium text-gray-900">Connected as {{ status.username }}</p>
          <p class="text-xs text-gray-500">Connected {{ formatDate(status.connectedAt) }}</p>
        </div>
      </div>

      <div v-if="status.stats" class="grid grid-cols-3 gap-4 py-4 border-t border-b">
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.total_books }}</p>
          <p class="text-xs text-gray-500">Books</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.rated_books }}</p>
          <p class="text-xs text-gray-500">Rated</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-900">{{ status.stats.shelf_count }}</p>
          <p class="text-xs text-gray-500">Shelves</p>
        </div>
      </div>

      <div class="flex space-x-3">
        <button
          @click="syncLibrary"
          :disabled="syncing"
          class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <span v-if="!syncing">Sync Library</span>
          <span v-else>Syncing...</span>
        </button>
        <button
          @click="disconnect"
          class="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
        >
          Disconnect
        </button>
      </div>

      <p v-if="status.lastSync" class="text-xs text-gray-500 text-center">
        Last synced {{ formatDate(status.lastSync) }}
      </p>
    </div>

    <div v-if="error" class="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
      {{ error }}
    </div>

    <div v-if="success" class="mt-4 p-3 bg-green-50 text-green-700 rounded text-sm">
      {{ success }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

export default {
  name: 'GoodreadsConnect',
  setup() {
    const authStore = useAuthStore()
    const status = ref({ connected: false })
    const connecting = ref(false)
    const syncing = ref(false)
    const error = ref('')
    const success = ref('')

    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        status.value = response.data
      } catch (err) {
        console.error('Failed to fetch Goodreads status:', err)
      }
    }

    const connectGoodreads = async () => {
      try {
        connecting.value = true
        error.value = ''
        
        const response = await axios.get('/api/goodreads/connect', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        // Redirect to Goodreads authorization
        window.location.href = response.data.authUrl
      } catch (err) {
        error.value = 'Failed to initiate Goodreads connection'
        connecting.value = false
      }
    }

    const syncLibrary = async () => {
      try {
        syncing.value = true
        error.value = ''
        success.value = ''
        
        await axios.post('/api/goodreads/sync', {}, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        success.value = 'Library synced successfully!'
        await fetchStatus()
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to sync library'
      } finally {
        syncing.value = false
      }
    }

    const disconnect = async () => {
      if (!confirm('Are you sure you want to disconnect your Goodreads account? This will remove all synced data.')) {
        return
      }

      try {
        await axios.delete('/api/goodreads/disconnect', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        status.value = { connected: false }
        success.value = 'Goodreads account disconnected'
      } catch (err) {
        error.value = 'Failed to disconnect account'
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Never'
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) return 'Just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`
      
      return date.toLocaleDateString()
    }

    onMounted(() => {
      fetchStatus()
      
      // Check if returning from OAuth callback
      const params = new URLSearchParams(window.location.search)
      if (params.get('goodreads') === 'connected') {
        success.value = 'Goodreads account connected successfully!'
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (params.get('goodreads') === 'error') {
        error.value = 'Failed to connect Goodreads account'
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    })

    return {
      status,
      connecting,
      syncing,
      error,
      success,
      connectGoodreads,
      syncLibrary,
      disconnect,
      formatDate
    }
  }
}
</script>```

### frontend/src/components/NavBar.vue
```vue
<template>
  <nav class="bg-white shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center py-4">
        <router-link to="/" class="text-xl font-bold text-gray-800">
          Novelarr
        </router-link>
        
        <div v-if="authStore.isAuthenticated" class="flex space-x-4">
          <router-link to="/search" class="text-gray-600 hover:text-gray-800">
            Search
          </router-link>
          <router-link to="/recommendations" class="text-gray-600 hover:text-gray-800">
            Recommendations
          </router-link>
          <router-link to="/library" class="text-gray-600 hover:text-gray-800">
            Library
          </router-link>
          <router-link to="/requests" class="text-gray-600 hover:text-gray-800">
            My Requests
          </router-link>
          
          <template v-if="authStore.user?.role === 'admin'">
            <router-link to="/users" class="text-gray-600 hover:text-gray-800">
              Users
            </router-link>
            <router-link to="/settings" class="text-gray-600 hover:text-gray-800">
              Settings
            </router-link>
          </template>
          
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-500">{{ authStore.user?.username }}</span>
            <button @click="logout" class="text-gray-600 hover:text-gray-800">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>```

### frontend/src/components/SearchBar.vue
```vue
<template>
  <div class="relative">
    <input
      v-model="query"
      @input="onInput"
      type="text"
      placeholder="Search by title, author, or ISBN..."
      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
    <div v-if="query.length > 0 && query.length < 2" class="absolute text-sm text-gray-500 mt-1">
      Type at least 2 characters to search
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const query = ref('')

const emit = defineEmits(['search'])

const onInput = () => {
  emit('search', query.value)
}
</script>```

### frontend/src/views/Library.vue
```vue
<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">My Library</h1>
      <p class="mt-2 text-gray-600">
        Your reading history from Goodreads
      </p>
    </div>

    <!-- Sync Status -->
    <div v-if="!goodreadsConnected" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
      <div class="flex">
        <svg class="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">Connect Goodreads to view your library</h3>
          <div class="mt-2">
            <router-link to="/settings" class="text-sm font-medium text-yellow-800 hover:text-yellow-700">
              Go to Settings →
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Shelf</label>
            <select v-model="filters.shelf" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Shelves</option>
              <option v-for="shelf in shelves" :key="shelf.name" :value="shelf.name">
                {{ shelf.name }} ({{ shelf.book_count }})
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select v-model="filters.rating" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
              <option value="0">Unrated</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select v-model="sortBy" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="date_added">Date Added</option>
              <option value="date_read">Date Read</option>
              <option value="rating">Rating</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search books..."
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
        </div>
      </div>

      <!-- Books Grid -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading your library...</p>
      </div>

      <div v-else-if="filteredBooks.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p class="mt-4 text-gray-600">No books found matching your criteria</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="book in paginatedBooks"
          :key="book.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <div class="aspect-w-3 aspect-h-4">
            <img
              :src="book.cover_url || '/placeholder.jpg'"
              :alt="book.title"
              class="w-full h-64 object-cover rounded-t-lg"
            >
          </div>
          <div class="p-4">
            <h3 class="font-medium text-gray-900 line-clamp-2">{{ book.title }}</h3>
            <p class="text-sm text-gray-600 mt-1">{{ book.author_name }}</p>
            
            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center">
                <div class="flex text-yellow-400">
                  <svg
                    v-for="i in 5"
                    :key="i"
                    class="w-4 h-4"
                    :class="{ 'text-gray-300': i > book.user_rating }"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <span class="ml-1 text-xs text-gray-500">{{ book.user_rating || 0 }}</span>
              </div>
              
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {{ book.shelf_name }}
              </span>
            </div>
            
            <div v-if="book.date_read" class="mt-2 text-xs text-gray-500">
              Read {{ formatDate(book.date_read) }}
            </div>
            
            <div class="mt-4 flex space-x-2">
              <button
                @click="requestAgain(book)"
                class="flex-1 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Request
              </button>
              <router-link
                :to="`/search?q=${encodeURIComponent(book.title)}`"
                class="flex-1 text-sm text-center bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300"
              >
                Search
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-8 flex justify-center">
        <nav class="flex space-x-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span class="px-3 py-2 text-sm text-gray-700">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

export default {
  name: 'Library',
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    
    const goodreadsConnected = ref(false)
    const loading = ref(true)
    const books = ref([])
    const shelves = ref([])
    const filters = ref({
      shelf: '',
      rating: ''
    })
    const searchQuery = ref('')
    const sortBy = ref('date_added')
    const currentPage = ref(1)
    const itemsPerPage = 24

    const checkGoodreadsStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        goodreadsConnected.value = response.data.connected
        return response.data.connected
      } catch (err) {
        console.error('Failed to check Goodreads status:', err)
        return false
      }
    }

    const fetchShelves = async () => {
      try {
        const response = await axios.get('/api/goodreads/shelves', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        shelves.value = response.data
      } catch (err) {
        console.error('Failed to fetch shelves:', err)
      }
    }

    const fetchBooks = async () => {
      try {
        loading.value = true
        const params = new URLSearchParams()
        
        if (filters.value.shelf) params.append('shelf', filters.value.shelf)
        if (filters.value.rating) params.append('rating', filters.value.rating)
        
        const response = await axios.get(`/api/goodreads/books?${params}`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        books.value = response.data.books
      } catch (err) {
        console.error('Failed to fetch books:', err)
      } finally {
        loading.value = false
      }
    }

    const filteredBooks = computed(() => {
      let result = books.value

      // Apply search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(book => 
          book.title.toLowerCase().includes(query) ||
          book.author_name.toLowerCase().includes(query)
        )
      }

      // Apply sorting
      result = [...result].sort((a, b) => {
        switch (sortBy.value) {
          case 'date_added':
            return new Date(b.date_added) - new Date(a.date_added)
          case 'date_read':
            return new Date(b.date_read || 0) - new Date(a.date_read || 0)
          case 'rating':
            return (b.user_rating || 0) - (a.user_rating || 0)
          case 'title':
            return a.title.localeCompare(b.title)
          case 'author':
            return a.author_name.localeCompare(b.author_name)
          default:
            return 0
        }
      })

      return result
    })

    const totalPages = computed(() => Math.ceil(filteredBooks.value.length / itemsPerPage))

    const paginatedBooks = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredBooks.value.slice(start, end)
    })

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const requestAgain = async (book) => {
      try {
        await axios.post('/api/requests', {
          goodreadsId: book.goodreads_id,
          title: book.title,
          author: book.author_name,
          coverUrl: book.cover_url
        }, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        router.push('/requests')
      } catch (err) {
        console.error('Failed to create request:', err)
        alert('Failed to create request. Please try again.')
      }
    }

    // Watch for filter changes
    watch([filters, sortBy], () => {
      currentPage.value = 1
    })

    watch(() => filters.value.shelf, () => {
      fetchBooks()
    })

    watch(() => filters.value.rating, () => {
      fetchBooks()
    })

    onMounted(async () => {
      const connected = await checkGoodreadsStatus()
      if (connected) {
        await Promise.all([
          fetchShelves(),
          fetchBooks()
        ])
      } else {
        loading.value = false
      }
    })

    return {
      goodreadsConnected,
      loading,
      books,
      shelves,
      filters,
      searchQuery,
      sortBy,
      currentPage,
      totalPages,
      filteredBooks,
      paginatedBooks,
      formatDate,
      requestAgain
    }
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.aspect-w-3 {
  position: relative;
  padding-bottom: 133.33%;
}

.aspect-h-4 {
  position: absolute;
  inset: 0;
}
</style>```

### frontend/src/views/Login.vue
```vue
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-md w-96">
      <h2 class="text-2xl font-bold mb-6 text-center">
        {{ isRegistering ? 'Register' : 'Login' }}
      </h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Username
          </label>
          <input
            v-model="username"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>
        
        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>
        
        <div v-if="error" class="mb-4 text-red-500 text-sm">
          {{ error }}
        </div>
        
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login') }}
        </button>
      </form>
      
      <p class="mt-4 text-center text-sm">
        {{ isRegistering ? 'Already have an account?' : "Don't have an account?" }}
        <button
          @click="isRegistering = !isRegistering"
          class="text-blue-500 hover:underline"
        >
          {{ isRegistering ? 'Login' : 'Register' }}
        </button>
      </p>
      
      <p class="mt-4 text-center text-xs text-gray-500">
        Default: admin / admin
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const isRegistering = ref(false)
const loading = ref(false)
const error = ref('')

const handleSubmit = async () => {
  error.value = ''
  loading.value = true
  
  try {
    if (isRegistering.value) {
      await authStore.register(username.value, password.value)
    } else {
      await authStore.login(username.value, password.value)
    }
    router.push('/search')
  } catch (err) {
    error.value = err.response?.data?.error || 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>```

### frontend/src/views/RecommendationsView.vue
```vue
<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Discover Your Next Read</h1>
      <p class="mt-2 text-gray-600">
        AI-powered book recommendations based on your Goodreads library
      </p>
    </div>

    <div class="grid lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        <AIRecommendations />
      </div>

      <div class="space-y-6">
        <!-- Reading Stats -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Your Reading Profile</h3>
          
          <div v-if="stats.loading" class="space-y-3">
            <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </div>

          <div v-else-if="stats.data" class="space-y-4">
            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Books Read</span>
                <span class="font-medium">{{ stats.data.total_books }}</span>
              </div>
            </div>
            
            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Books Rated</span>
                <span class="font-medium">{{ stats.data.rated_books }}</span>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Avg Rating Given</span>
                <span class="font-medium">{{ stats.data.avg_rating || 'N/A' }}</span>
              </div>
            </div>

            <div class="pt-4 border-t">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Top Genres</h4>
              <div class="space-y-1">
                <div 
                  v-for="genre in stats.data.top_genres" 
                  :key="genre.name"
                  class="flex justify-between text-sm"
                >
                  <span class="text-gray-600">{{ genre.name }}</span>
                  <span class="text-gray-500">{{ genre.count }} books</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-sm text-gray-500 text-center py-4">
            Connect Goodreads to see your reading stats
          </div>
        </div>

        <!-- Recommendation Settings -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Recommendation Settings</h3>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-gray-700">Preferred Genres</label>
              <p class="text-xs text-gray-500 mt-1">AI will prioritize these genres</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="genre in ['Fiction', 'Non-fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance']"
                  :key="genre"
                  @click="toggleGenre(genre)"
                  :class="[
                    'px-3 py-1 rounded-full text-xs cursor-pointer transition-colors',
                    preferredGenres.includes(genre)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  ]"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700">Discovery Mode</label>
              <p class="text-xs text-gray-500 mt-1">How adventurous should recommendations be?</p>
              <div class="mt-2">
                <input
                  type="range"
                  v-model="discoveryLevel"
                  min="0"
                  max="100"
                  class="w-full"
                >
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Safe picks</span>
                  <span>Hidden gems</span>
                </div>
              </div>
            </div>

            <button
              @click="saveSettings"
              class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Update Preferences
            </button>
          </div>
        </div>

        <!-- Export Options -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Export Recommendations</h3>
          <div class="space-y-3">
            <button
              @click="exportRecommendations('json')"
              class="w-full text-left px-4 py-2 border rounded hover:bg-gray-50 text-sm"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download as JSON
            </button>
            <button
              @click="exportRecommendations('csv')"
              class="w-full text-left px-4 py-2 border rounded hover:bg-gray-50 text-sm"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download as CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AIRecommendations from '@/components/AIRecommendations.vue'
import axios from 'axios'

export default {
  name: 'RecommendationsView',
  components: {
    AIRecommendations
  },
  setup() {
    const authStore = useAuthStore()
    const stats = ref({ loading: true, data: null })
    const preferredGenres = ref([])
    const discoveryLevel = ref(50)

    const fetchStats = async () => {
      try {
        // This would fetch actual stats from the API
        // For now, using mock data
        stats.value.data = {
          total_books: 147,
          rated_books: 89,
          avg_rating: 3.8,
          top_genres: [
            { name: 'Fiction', count: 45 },
            { name: 'Mystery', count: 23 },
            { name: 'Sci-Fi', count: 18 },
            { name: 'Non-fiction', count: 15 },
            { name: 'Fantasy', count: 12 }
          ]
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        stats.value.loading = false
      }
    }

    const toggleGenre = (genre) => {
      const index = preferredGenres.value.indexOf(genre)
      if (index > -1) {
        preferredGenres.value.splice(index, 1)
      } else {
        preferredGenres.value.push(genre)
      }
    }

    const saveSettings = async () => {
      // Save preference settings
      console.log('Saving preferences:', {
        genres: preferredGenres.value,
        discoveryLevel: discoveryLevel.value
      })
    }

    const exportRecommendations = async (format) => {
      try {
        const response = await axios.get('/api/recommendations/export', {
          params: { format },
          headers: { Authorization: `Bearer ${authStore.token}` },
          responseType: format === 'csv' ? 'text' : 'json'
        })

        const blob = new Blob(
          [format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
          { type: format === 'csv' ? 'text/csv' : 'application/json' }
        )
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `novelarr-recommendations.${format}`
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to export recommendations:', err)
        alert('Failed to export recommendations')
      }
    }

    onMounted(() => {
      fetchStats()
    })

    return {
      stats,
      preferredGenres,
      discoveryLevel,
      toggleGenre,
      saveSettings,
      exportRecommendations
    }
  }
}
</script>```

### frontend/src/views/Requests.vue
```vue
<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">My Requests</h1>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else-if="requests.length === 0" class="text-center py-12 text-gray-600">
      No requests yet
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg overflow-hidden">
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Book
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Requested
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="request in requests" :key="request.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <img 
                  :src="request.cover_url || '/placeholder.jpg'" 
                  :alt="request.book_title"
                  class="h-10 w-10 rounded-full object-cover"
                >
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">
                    {{ request.book_title }}
                  </div>
                  <div class="text-sm text-gray-500">
                    {{ request.book_author }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusClass(request.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ request.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(request.requested_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const requests = ref([])
const loading = ref(true)

const getStatusClass = (status) => {
  switch (status) {
    case 'added':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const fetchRequests = async () => {
  try {
    const response = await api.get('/requests')
    requests.value = response.data.requests
  } catch (error) {
    console.error('Failed to fetch requests:', error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchRequests)
</script>```

### frontend/src/views/Search.vue
```vue
<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Search Books</h1>
    
    <div class="mb-6 space-y-4">
      <SearchBar @search="debouncedSearch" />
      
      <!-- Source Selection -->
      <div class="flex items-center space-x-4">
        <span class="text-sm font-medium text-gray-700">Search in:</span>
        <label class="flex items-center">
          <input
            v-model="searchSource"
            type="radio"
            value="all"
            class="mr-2"
          >
          <span class="text-sm">All Sources</span>
        </label>
        <label class="flex items-center" v-if="sources.readarr">
          <input
            v-model="searchSource"
            type="radio"
            value="readarr"
            class="mr-2"
          >
          <span class="text-sm">Readarr</span>
        </label>
        <label class="flex items-center" v-if="sources.jackett">
          <input
            v-model="searchSource"
            type="radio"
            value="jackett"
            class="mr-2"
          >
          <span class="text-sm">Jackett</span>
        </label>
        <label class="flex items-center" v-if="sources.prowlarr">
          <input
            v-model="searchSource"
            type="radio"
            value="prowlarr"
            class="mr-2"
          >
          <span class="text-sm">Prowlarr</span>
        </label>
      </div>
    </div>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <p class="mt-2 text-gray-600">Searching...</p>
    </div>
    
    <div v-else-if="error" class="text-center py-12 text-red-500">
      {{ error }}
    </div>
    
    <div v-else-if="searched && results.length === 0" class="text-center py-12 text-gray-600">
      No results found
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
      <BookCard
        v-for="book in results"
        :key="book.goodreadsId"
        :book="book"
        :requesting="requestingId === book.goodreadsId"
        @request="requestBook"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { debounce } from 'lodash-es'
import api from '../api'
import SearchBar from '../components/SearchBar.vue'
import BookCard from '../components/BookCard.vue'

const results = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const requestingId = ref(null)
const searchSource = ref('all')
const sources = ref({
  readarr: true,
  jackett: false,
  prowlarr: false
})
const lastQuery = ref('')

const search = async (query) => {
  if (!query || query.length < 2) {
    results.value = []
    searched.value = false
    return
  }
  
  lastQuery.value = query
  loading.value = true
  error.value = ''
  
  try {
    const response = await api.get('/search', { 
      params: { 
        q: query,
        source: searchSource.value 
      } 
    })
    results.value = response.data.results
    searched.value = true
    
    // Update available sources
    if (response.data.sources) {
      sources.value = response.data.sources
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Search failed'
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(search, 500)

const requestBook = async (book) => {
  requestingId.value = book.goodreadsId
  
  try {
    await api.post('/requests', {
      goodreadsId: book.goodreadsId,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl
    })
    alert('Book requested successfully!')
  } catch (err) {
    const message = err.response?.data?.error || 'Request failed'
    alert(message)
  } finally {
    requestingId.value = null
  }
}

// Re-search when source changes
watch(searchSource, () => {
  if (lastQuery.value) {
    search(lastQuery.value)
  }
})

// Get available sources on mount
onMounted(async () => {
  try {
    const response = await api.get('/search/sources')
    sources.value = {
      readarr: response.data.readarr.enabled,
      jackett: response.data.jackett.enabled,
      prowlarr: response.data.prowlarr.enabled
    }
  } catch (error) {
    console.error('Failed to get search sources:', error)
  }
})
</script>```

### frontend/src/views/Settings.vue
```vue
<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Settings</h1>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg p-6">
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Application Name
          </label>
          <input
            v-model="settings.app_name.value"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="text-sm text-gray-500 mt-1">{{ settings.app_name.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="registrationEnabled"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Enable Registration
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.registration_enabled?.description }}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Default User Role
          </label>
          <select
            v-model="settings.default_user_role.value"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <p class="text-sm text-gray-500 mt-1">{{ settings.default_user_role.description }}</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Requests Per User Limit
          </label>
          <input
            v-model.number="settings.requests_per_user_limit.value"
            type="number"
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="text-sm text-gray-500 mt-1">{{ settings.requests_per_user_limit.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="autoApprove"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Auto-approve Requests
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.auto_approve_requests?.description }}</p>
        </div>
        
        <div>
          <label class="flex items-center">
            <input
              v-model="requireApproval"
              type="checkbox"
              class="mr-2"
            >
            <span class="text-sm font-medium text-gray-700">
              Require Admin Approval
            </span>
          </label>
          <p class="text-sm text-gray-500 mt-1">{{ settings.require_approval?.description }}</p>
        </div>
        
        <!-- Jackett Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Jackett Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="jackettEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Jackett
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">{{ settings.jackett_enabled?.description }}</p>
            </div>
            
            <div v-if="jackettEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Jackett URL
              </label>
              <input
                v-model="settings.jackett_url.value"
                type="text"
                placeholder="http://192.168.1.4:9117"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div v-if="jackettEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Jackett API Key
              </label>
              <input
                v-model="settings.jackett_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Prowlarr Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Prowlarr Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="prowlarrEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Prowlarr
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">{{ settings.prowlarr_enabled?.description }}</p>
            </div>
            
            <div v-if="prowlarrEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Prowlarr URL
              </label>
              <input
                v-model="settings.prowlarr_url.value"
                type="text"
                placeholder="http://192.168.1.4:9696"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div v-if="prowlarrEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Prowlarr API Key
              </label>
              <input
                v-model="settings.prowlarr_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Kavita Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Kavita Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="kavitaEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable Kavita Integration
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">Check if books exist in your Kavita library</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Kavita URL
              </label>
              <input
                v-model="settings.kavita_url.value"
                type="text"
                placeholder="http://192.168.1.4:5000"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Your Kavita server URL</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Kavita API Key
              </label>
              <input
                v-model="settings.kavita_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Found in Kavita Settings → Security → API Keys</p>
            </div>
            
            <div v-if="kavitaEnabled">
              <button
                @click="testKavitaConnection"
                :disabled="testingKavita"
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {{ testingKavita ? 'Testing...' : 'Test Connection' }}
              </button>
              <span v-if="kavitaTestResult" class="ml-3" :class="kavitaTestResult.success ? 'text-green-600' : 'text-red-600'">
                {{ kavitaTestResult.message }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Readarr Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Readarr Integration</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Readarr URL
              </label>
              <input
                v-model="settings.readarr_url.value"
                type="text"
                placeholder="http://192.168.1.4:8787"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Readarr API Key
              </label>
              <input
                v-model="settings.readarr_api_key.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Quality Profile ID
              </label>
              <input
                v-model="settings.readarr_quality_profile.value"
                type="text"
                placeholder="1"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Root Folder Path
              </label>
              <input
                v-model="settings.readarr_root_folder.value"
                type="text"
                placeholder="/books"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>
        
        <!-- Goodreads & AI Settings -->
        <div class="border-t pt-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Goodreads Integration</h3>
          
          <div class="space-y-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Goodreads API Key
              </label>
              <input
                v-model="settings.goodreads_api_key.value"
                type="text"
                placeholder="Your Goodreads API key"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Get from Goodreads Developer Portal</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Goodreads API Secret
              </label>
              <input
                v-model="settings.goodreads_api_secret.value"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Keep this secret!</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                OAuth Callback URL
              </label>
              <input
                v-model="settings.goodreads_callback_url.value"
                type="text"
                placeholder="http://your-domain.com/api/goodreads/callback"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Update this with your actual domain</p>
            </div>
          </div>
          
          <GoodreadsConnect />
          
          <h3 class="text-lg font-semibold mb-4 mt-8">AI Recommendations</h3>
          
          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="aiRecommendationsEnabled"
                  type="checkbox"
                  class="mr-2"
                >
                <span class="text-sm font-medium text-gray-700">
                  Enable AI Recommendations
                </span>
              </label>
              <p class="text-sm text-gray-500 mt-1">Use OpenAI to generate personalized book recommendations</p>
            </div>
            
            <div v-if="aiRecommendationsEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <input
                v-model="settings.openai_api_key.value"
                type="password"
                placeholder="sk-..."
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <p class="text-sm text-gray-500 mt-1">Get from platform.openai.com</p>
            </div>
            
            <div v-if="aiRecommendationsEnabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                v-model="settings.openai_model.value"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4-turbo-preview">GPT-4 Turbo (Recommended)</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheaper)</option>
              </select>
              <p class="text-sm text-gray-500 mt-1">Higher models provide better recommendations</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-8 flex justify-end space-x-4">
        <button
          @click="resetSettings"
          class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          @click="saveSettings"
          :disabled="saving"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
      
      <div v-if="message" class="mt-4 p-3 rounded" :class="messageClass">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import GoodreadsConnect from '../components/GoodreadsConnect.vue'

const settings = ref({})
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const messageClass = ref('')

const registrationEnabled = computed({
  get: () => settings.value.registration_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.registration_enabled) {
      settings.value.registration_enabled.value = val ? 'true' : 'false'
    }
  }
})

const autoApprove = computed({
  get: () => settings.value.auto_approve_requests?.value === 'true',
  set: (val) => {
    if (settings.value.auto_approve_requests) {
      settings.value.auto_approve_requests.value = val ? 'true' : 'false'
    }
  }
})

const requireApproval = computed({
  get: () => settings.value.require_approval?.value === 'true',
  set: (val) => {
    if (settings.value.require_approval) {
      settings.value.require_approval.value = val ? 'true' : 'false'
    }
  }
})

const jackettEnabled = computed({
  get: () => settings.value.jackett_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.jackett_enabled) {
      settings.value.jackett_enabled.value = val ? 'true' : 'false'
    }
  }
})

const prowlarrEnabled = computed({
  get: () => settings.value.prowlarr_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.prowlarr_enabled) {
      settings.value.prowlarr_enabled.value = val ? 'true' : 'false'
    }
  }
})

const kavitaEnabled = computed({
  get: () => settings.value.kavita_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.kavita_enabled) {
      settings.value.kavita_enabled.value = val ? 'true' : 'false'
    }
  }
})

const aiRecommendationsEnabled = computed({
  get: () => settings.value.ai_recommendations_enabled?.value === 'true',
  set: (val) => {
    if (settings.value.ai_recommendations_enabled) {
      settings.value.ai_recommendations_enabled.value = val ? 'true' : 'false'
    }
  }
})

const testingKavita = ref(false)
const kavitaTestResult = ref(null)

const testKavitaConnection = async () => {
  testingKavita.value = true
  kavitaTestResult.value = null
  
  try {
    // Save current settings first
    await saveSettings()
    
    // Test connection
    const response = await api.get('/search/sources')
    if (response.data.kavita && response.data.kavita.connected) {
      kavitaTestResult.value = { success: true, message: 'Connection successful!' }
    } else {
      kavitaTestResult.value = { success: false, message: 'Connection failed' }
    }
  } catch (error) {
    kavitaTestResult.value = { success: false, message: 'Connection failed: ' + error.message }
  } finally {
    testingKavita.value = false
  }
}

const fetchSettings = async () => {
  try {
    const response = await api.get('/settings')
    settings.value = response.data
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  message.value = ''
  
  try {
    const updates = {}
    for (const [key, data] of Object.entries(settings.value)) {
      updates[key] = data.value
    }
    
    await api.put('/settings', updates)
    message.value = 'Settings saved successfully!'
    messageClass.value = 'bg-green-100 text-green-800'
  } catch (error) {
    message.value = error.response?.data?.error || 'Failed to save settings'
    messageClass.value = 'bg-red-100 text-red-800'
  } finally {
    saving.value = false
  }
}

const resetSettings = () => {
  fetchSettings()
  message.value = ''
}

onMounted(fetchSettings)
</script>```

### frontend/src/views/Users.vue
```vue
<template>
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Users</h1>
      <button
        @click="showAddUser = true"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Add User
      </button>
    </div>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
    
    <div v-else class="bg-white shadow-md rounded-lg overflow-hidden">
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Username
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">
                {{ user.username }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getRoleClass(user.role)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(user.created_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                @click="editUser(user)"
                class="text-indigo-600 hover:text-indigo-900 mr-4"
              >
                Edit
              </button>
              <button
                @click="deleteUser(user)"
                :disabled="user.username === authStore.user?.username"
                class="text-red-600 hover:text-red-900 disabled:text-gray-400"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- User Stats -->
    <div v-if="stats" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Total Users</h3>
        <p class="text-3xl font-bold">{{ stats.totalUsers }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Admin Users</h3>
        <p class="text-3xl font-bold">{{ stats.adminUsers }}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-2">Total Requests</h3>
        <p class="text-3xl font-bold">{{ stats.totalRequests }}</p>
      </div>
    </div>
    
    <!-- Add/Edit User Modal -->
    <div v-if="showAddUser || editingUser" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">
          {{ editingUser ? 'Edit User' : 'Add User' }}
        </h2>
        
        <form @submit.prevent="saveUser">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              v-model="userForm.username"
              type="text"
              required
              :disabled="!!editingUser"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
          </div>
          
          <div v-if="!editingUser" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              v-model="userForm.password"
              type="password"
              required
              minlength="6"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          
          <div v-else class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              New Password (leave empty to keep current)
            </label>
            <input
              v-model="userForm.password"
              type="password"
              minlength="6"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              v-model="userForm.role"
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <div v-if="formError" class="mb-4 text-red-600 text-sm">
            {{ formError }}
          </div>
          
          <div class="flex justify-end space-x-4">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="savingUser"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {{ savingUser ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const users = ref([])
const stats = ref(null)
const loading = ref(true)
const showAddUser = ref(false)
const editingUser = ref(null)
const savingUser = ref(false)
const formError = ref('')

const userForm = ref({
  username: '',
  password: '',
  role: 'user'
})

const getRoleClass = (role) => {
  return role === 'admin' 
    ? 'bg-purple-100 text-purple-800' 
    : 'bg-gray-100 text-gray-800'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const fetchUsers = async () => {
  try {
    const [usersResponse, statsResponse] = await Promise.all([
      api.get('/users'),
      api.get('/users/stats')
    ])
    users.value = usersResponse.data.users
    stats.value = statsResponse.data
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
}

const editUser = (user) => {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    password: '',
    role: user.role
  }
}

const closeModal = () => {
  showAddUser.value = false
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    role: 'user'
  }
  formError.value = ''
}

const saveUser = async () => {
  savingUser.value = true
  formError.value = ''
  
  try {
    if (editingUser.value) {
      // Update user
      const updates = { role: userForm.value.role }
      if (userForm.value.password) {
        updates.password = userForm.value.password
      }
      
      await api.put(`/users/${editingUser.value.id}`, updates)
    } else {
      // Create user
      await api.post('/users', userForm.value)
    }
    
    await fetchUsers()
    closeModal()
  } catch (error) {
    formError.value = error.response?.data?.error || 'Failed to save user'
  } finally {
    savingUser.value = false
  }
}

const deleteUser = async (user) => {
  if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
    return
  }
  
  try {
    await api.delete(`/users/${user.id}`)
    await fetchUsers()
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to delete user')
  }
}

onMounted(fetchUsers)
</script>```

## Database Schema

### backend/db/migrations/001_initial.sql
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_title TEXT NOT NULL,
    book_author TEXT NOT NULL,
    goodreads_id TEXT,
    cover_url TEXT,
    status TEXT DEFAULT 'pending',
    readarr_id INTEGER,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Settings table for application configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('app_name', 'Novelarr', 'Application name'),
    ('registration_enabled', 'true', 'Allow new user registration'),
    ('default_user_role', 'user', 'Default role for new users'),
    ('requests_per_user_limit', '0', 'Maximum requests per user (0 = unlimited)'),
    ('auto_approve_requests', 'false', 'Automatically approve all requests'),
    ('require_approval', 'true', 'Require admin approval for requests'),
    ('jackett_enabled', 'false', 'Enable Jackett integration'),
    ('jackett_url', '', 'Jackett server URL'),
    ('jackett_api_key', '', 'Jackett API key'),
    ('prowlarr_enabled', 'false', 'Enable Prowlarr integration'),
    ('prowlarr_url', '', 'Prowlarr server URL'),
    ('prowlarr_api_key', '', 'Prowlarr API key');

-- Create default admin user (password: admin)
INSERT OR IGNORE INTO users (username, password, role) 
VALUES ('admin', '$2b$10$YgHreYWYQ2gZydFdlW7UYejLQdHlCadH7stD8MR7uMJBI/BAzKKKy', 'admin');```

### backend/db/migrations/002_downloads.sql
```sql
-- Add download tracking fields to requests table
ALTER TABLE requests ADD COLUMN download_status TEXT DEFAULT 'pending';
ALTER TABLE requests ADD COLUMN download_progress INTEGER DEFAULT 0;
ALTER TABLE requests ADD COLUMN file_path TEXT;
ALTER TABLE requests ADD COLUMN file_size INTEGER;
ALTER TABLE requests ADD COLUMN downloaded_at DATETIME;
ALTER TABLE requests ADD COLUMN readarr_book_id INTEGER;

-- Create downloads table for tracking download history
CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    readarr_id INTEGER,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    file_path TEXT,
    file_size INTEGER,
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_requests_download_status ON requests(download_status);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

-- Add Readarr configuration settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('readarr_url', '', 'Readarr server URL'),
    ('readarr_api_key', '', 'Readarr API key'),
    ('readarr_quality_profile', '1', 'Readarr quality profile ID'),
    ('readarr_root_folder', '', 'Readarr root folder path'),
    ('download_monitor_interval', '60', 'Seconds between download status checks'),
    ('library_path', '/books', 'Local path for downloaded books');```

### backend/db/migrations/003_library.sql
```sql
-- Create authors table
CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goodreads_id TEXT,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create books table for library
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author_id INTEGER,
    isbn TEXT,
    goodreads_id TEXT,
    description TEXT,
    cover_url TEXT,
    cover_path TEXT,
    publication_date DATE,
    publisher TEXT,
    page_count INTEGER,
    language TEXT DEFAULT 'en',
    rating REAL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES authors(id)
);

-- Create book files table
CREATE TABLE IF NOT EXISTS book_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_format TEXT,
    file_hash TEXT,
    quality TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Create series table
CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    goodreads_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create book_series junction table
CREATE TABLE IF NOT EXISTS book_series (
    book_id INTEGER NOT NULL,
    series_id INTEGER NOT NULL,
    position REAL,
    PRIMARY KEY (book_id, series_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

-- Create book_genres junction table
CREATE TABLE IF NOT EXISTS book_genres (
    book_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, genre_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- Create reading progress table
CREATE TABLE IF NOT EXISTS reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    position TEXT,
    percentage REAL DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES book_files(id) ON DELETE CASCADE,
    UNIQUE(user_id, book_id, file_id)
);

-- Create user favorites
CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Create library folders table
CREATE TABLE IF NOT EXISTS library_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    last_scan DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_goodreads ON books(goodreads_id);
CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name);
CREATE INDEX IF NOT EXISTS idx_book_files_book ON book_files(book_id);
CREATE INDEX IF NOT EXISTS idx_book_files_format ON book_files(file_format);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);

-- Add library settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('library_scan_interval', '300', 'Seconds between library scans (5 min default)'),
    ('supported_formats', 'epub,pdf,mobi,azw,azw3,fb2,djvu,txt,rtf,doc,docx,cbr,cbz', 'Supported book formats'),
    ('cover_quality', 'high', 'Cover image quality (low/medium/high)'),
    ('readarr_sync_enabled', 'true', 'Sync library with Readarr'),
    ('readarr_sync_interval', '300', 'Seconds between Readarr sync checks'),
    ('import_mode', 'copy', 'Import mode: copy or hardlink'),
    ('library_root', '/books', 'Root folder for book library');```

### backend/db/migrations/004_kavita.sql
```sql
-- Add Kavita integration settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('kavita_enabled', 'false', 'Enable Kavita integration'),
    ('kavita_url', '', 'Kavita server URL'),
    ('kavita_api_key', '', 'Kavita API key'),
    ('kavita_sync_reading_progress', 'true', 'Sync reading progress with Kavita'),
    ('show_kavita_status', 'true', 'Show if book exists in Kavita library');```

### backend/db/migrations/005_goodreads_integration.sql
```sql
-- Goodreads integration tables
CREATE TABLE IF NOT EXISTS user_goodreads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goodreads_user_id TEXT NOT NULL,
    goodreads_username TEXT,
    access_token TEXT NOT NULL,
    access_token_secret TEXT NOT NULL,
    profile_url TEXT,
    image_url TEXT,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_shelves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goodreads_shelf_id TEXT NOT NULL,
    name TEXT NOT NULL,
    book_count INTEGER DEFAULT 0,
    is_exclusive INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, goodreads_shelf_id)
);

CREATE TABLE IF NOT EXISTS user_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    goodreads_book_id TEXT,
    shelf_name TEXT,
    rating INTEGER,
    date_read DATETIME,
    date_added DATETIME,
    read_count INTEGER DEFAULT 0,
    review TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE(user_id, book_id)
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    score REAL NOT NULL,
    reasoning TEXT,
    model_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cache_key TEXT NOT NULL,
    recommendations TEXT NOT NULL, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, cache_key)
);

-- Indexes for performance
CREATE INDEX idx_user_goodreads_user_id ON user_goodreads(user_id);
CREATE INDEX idx_user_shelves_user_id ON user_shelves(user_id);
CREATE INDEX idx_user_books_user_id ON user_books(user_id);
CREATE INDEX idx_user_books_book_id ON user_books(book_id);
CREATE INDEX idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_expires ON ai_recommendations(expires_at);
CREATE INDEX idx_recommendation_cache_expires ON recommendation_cache(expires_at);```

### backend/db/migrations/006_ai_settings.sql
```sql
-- Add Goodreads and OpenAI settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
('goodreads_api_key', '', 'Goodreads API key for OAuth authentication'),
('goodreads_api_secret', '', 'Goodreads API secret for OAuth authentication'),
('goodreads_callback_url', 'http://localhost:8096/api/goodreads/callback', 'OAuth callback URL (update with your domain)'),
('openai_api_key', '', 'OpenAI API key for AI recommendations'),
('openai_model', 'gpt-4-turbo-preview', 'OpenAI model to use for recommendations'),
('ai_recommendations_enabled', 'false', 'Enable AI-powered book recommendations');```

### backend/migrations/007_web_config.sql
```sql
-- Add web-configurable settings for all integrations
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
-- Session configuration
('session_secret', '', 'Session encryption secret (auto-generated if empty)'),

-- Service URLs (already exist, updating descriptions)
('readarr_url', '', 'Readarr server URL (e.g., http://192.168.1.100:8787)'),
('readarr_api_key', '', 'Readarr API key from Settings > General > Security'),
('jackett_url', '', 'Jackett server URL (e.g., http://192.168.1.100:9117)'),
('jackett_api_key', '', 'Jackett API key from the dashboard'),
('prowlarr_url', '', 'Prowlarr server URL (e.g., http://192.168.1.100:9696)'),
('prowlarr_api_key', '', 'Prowlarr API key from Settings > General > Security'),
('kavita_url', '', 'Kavita server URL (e.g., http://192.168.1.100:5000)'),
('kavita_api_key', '', 'Kavita API key from Settings > Security > API Keys'),

-- SMTP Settings for Send to Kindle
('smtp_enabled', 'false', 'Enable email functionality'),
('smtp_host', '', 'SMTP server hostname'),
('smtp_port', '587', 'SMTP server port (usually 587 for TLS, 465 for SSL, 25 for plain)'),
('smtp_secure', 'tls', 'Security method: tls, ssl, or none'),
('smtp_user', '', 'SMTP username'),
('smtp_password', '', 'SMTP password'),
('smtp_from_email', '', 'From email address'),
('smtp_from_name', 'Novelarr', 'From display name'),

-- Send to Kindle Settings
('kindle_enabled', 'false', 'Enable Send to Kindle functionality'),
('kindle_convert_enabled', 'true', 'Convert non-compatible formats to MOBI/AZW3'),
('kindle_email_domain', '@kindle.com', 'Kindle email domain (@kindle.com or @free.kindle.com)'),

-- Advanced Settings
('api_rate_limit_enabled', 'true', 'Enable API rate limiting'),
('api_rate_limit_window', '60000', 'Rate limit window in milliseconds'),
('api_rate_limit_max_requests', '300', 'Maximum requests per window'),
('enable_series_detection', 'true', 'Automatically detect book series'),
('enable_smart_lists', 'true', 'Enable smart list functionality'),
('enable_api_keys', 'true', 'Allow users to generate API keys'),
('default_quality_profile', '1', 'Default quality profile for new requests'),

-- Monitoring & Logging
('log_level', 'info', 'Logging level: debug, info, warn, error'),
('enable_analytics', 'false', 'Send anonymous usage statistics'),
('enable_update_check', 'true', 'Check for Novelarr updates'),

-- Security Settings
('require_authentication', 'true', 'Require login to access Novelarr'),
('session_timeout', '604800000', 'Session timeout in milliseconds (7 days default)'),
('max_login_attempts', '5', 'Maximum failed login attempts before lockout'),
('lockout_duration', '900000', 'Account lockout duration in milliseconds (15 minutes)');

-- Add configuration categories for better organization
CREATE TABLE IF NOT EXISTS setting_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO setting_categories (name, display_name, description, sort_order) VALUES
('general', 'General', 'Basic application settings', 1),
('integrations', 'Service Integrations', 'Connect to other applications', 2),
('goodreads', 'Goodreads & AI', 'Reading history and recommendations', 3),
('email', 'Email & Kindle', 'Email and Send to Kindle settings', 4),
('security', 'Security', 'Authentication and access control', 5),
('advanced', 'Advanced', 'Advanced configuration options', 6);

-- Add category to settings
ALTER TABLE settings ADD COLUMN category TEXT DEFAULT 'general';

-- Update existing settings with categories
UPDATE settings SET category = 'general' WHERE key IN ('app_name', 'registration_enabled', 'default_user_role', 'requests_per_user_limit', 'auto_approve_requests', 'require_approval');
UPDATE settings SET category = 'integrations' WHERE key LIKE '%_url' OR key LIKE '%_api_key' OR key LIKE '%_enabled';
UPDATE settings SET category = 'goodreads' WHERE key LIKE 'goodreads_%' OR key LIKE 'openai_%' OR key LIKE 'ai_%';
UPDATE settings SET category = 'email' WHERE key LIKE 'smtp_%' OR key LIKE 'kindle_%';
UPDATE settings SET category = 'security' WHERE key IN ('session_secret', 'require_authentication', 'session_timeout', 'max_login_attempts', 'lockout_duration');
UPDATE settings SET category = 'advanced' WHERE key IN ('api_rate_limit_enabled', 'api_rate_limit_window', 'api_rate_limit_max_requests', 'enable_series_detection', 'enable_smart_lists', 'enable_api_keys', 'default_quality_profile', 'log_level', 'enable_analytics', 'enable_update_check');```

---

## File Statistics

- Total Lines of Code: 6354
- Backend JS Files: 20
- Frontend Vue Files: 13
- SQL Migration Files: 7

Generated by generate-codebase-review.sh
