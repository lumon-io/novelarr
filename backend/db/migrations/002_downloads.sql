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
    ('library_path', '/books', 'Local path for downloaded books');