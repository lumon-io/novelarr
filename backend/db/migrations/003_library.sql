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
    ('library_root', '/books', 'Root folder for book library');