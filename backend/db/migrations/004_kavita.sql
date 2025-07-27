-- Add Kavita integration settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('kavita_enabled', 'false', 'Enable Kavita integration'),
    ('kavita_url', '', 'Kavita server URL'),
    ('kavita_api_key', '', 'Kavita API key'),
    ('kavita_sync_reading_progress', 'true', 'Sync reading progress with Kavita'),
    ('show_kavita_status', 'true', 'Show if book exists in Kavita library');