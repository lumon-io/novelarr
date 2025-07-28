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

-- Create default admin user (password: admin123)
INSERT OR IGNORE INTO users (username, password, role) 
VALUES ('admin', '$2b$10$K3xVKKRp2A9ZJ0lzFt2OKuOHnNTUXMqKQlzlRzH9jqD.L.8vMJhBe', 'admin');