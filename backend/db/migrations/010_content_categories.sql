-- Add content type/category support

-- Create content types table
CREATE TABLE IF NOT EXISTS content_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    media_folder TEXT NOT NULL,
    download_folder TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add default content types
INSERT INTO content_types (name, display_name, icon, media_folder, download_folder, sort_order) VALUES
    ('books', 'Books', 'book', '/media/books', '/downloads/books', 1),
    ('audiobooks', 'Audiobooks', 'headphones', '/media/audiobooks', '/downloads/audiobooks', 2),
    ('magazines', 'Magazines', 'newspaper', '/media/magazines', '/downloads/magazines', 3),
    ('comics', 'Comics', 'image', '/media/comics', '/downloads/comics', 4),
    ('manga', 'Manga', 'book-open', '/media/manga', '/downloads/manga', 5);

-- Add content_type to requests table
ALTER TABLE requests ADD COLUMN content_type TEXT DEFAULT 'books';

-- Add content_type to downloads table
ALTER TABLE downloads ADD COLUMN content_type TEXT DEFAULT 'books';

-- Add content_type to library/books table if it exists
-- Note: This is for the extended library system from migration 003
-- Check if books table exists before altering
CREATE TEMP TABLE IF NOT EXISTS _temp_check AS 
SELECT name FROM sqlite_master WHERE type='table' AND name='books';

-- If books table exists, add content_type
-- SQLite doesn't support conditional ALTER TABLE, so we'll handle this in the app

-- Create content type specific settings
INSERT OR IGNORE INTO settings (key, value, description, category) VALUES
    -- Books specific
    ('books_enabled', 'true', 'Enable book requests and management', 'content_types'),
    ('books_quality_profile', '1', 'Default quality profile for books', 'content_types'),
    ('books_metadata_profile', '1', 'Default metadata profile for books', 'content_types'),
    ('books_root_folder', '/media/books', 'Root folder for organized books', 'content_types'),
    
    -- Audiobooks specific  
    ('audiobooks_enabled', 'true', 'Enable audiobook requests and management', 'content_types'),
    ('audiobooks_quality_profile', '1', 'Default quality profile for audiobooks', 'content_types'),
    ('audiobooks_metadata_profile', '1', 'Default metadata profile for audiobooks', 'content_types'),
    ('audiobooks_root_folder', '/media/audiobooks', 'Root folder for organized audiobooks', 'content_types'),
    
    -- Magazines specific
    ('magazines_enabled', 'false', 'Enable magazine requests and management', 'content_types'),
    ('magazines_quality_profile', '1', 'Default quality profile for magazines', 'content_types'),
    ('magazines_root_folder', '/media/magazines', 'Root folder for organized magazines', 'content_types'),
    
    -- Comics specific
    ('comics_enabled', 'false', 'Enable comic requests and management', 'content_types'),
    ('comics_quality_profile', '1', 'Default quality profile for comics', 'content_types'),
    ('comics_root_folder', '/media/comics', 'Root folder for organized comics', 'content_types'),
    
    -- Manga specific
    ('manga_enabled', 'false', 'Enable manga requests and management', 'content_types'),
    ('manga_quality_profile', '1', 'Default quality profile for manga', 'content_types'),
    ('manga_root_folder', '/media/manga', 'Root folder for organized manga', 'content_types');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_content_type ON requests(content_type);
CREATE INDEX IF NOT EXISTS idx_downloads_content_type ON downloads(content_type);

-- Update existing requests to have proper content type
UPDATE requests SET content_type = 'books' WHERE content_type IS NULL;