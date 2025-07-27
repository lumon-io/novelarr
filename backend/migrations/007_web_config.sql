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
UPDATE settings SET category = 'advanced' WHERE key IN ('api_rate_limit_enabled', 'api_rate_limit_window', 'api_rate_limit_max_requests', 'enable_series_detection', 'enable_smart_lists', 'enable_api_keys', 'default_quality_profile', 'log_level', 'enable_analytics', 'enable_update_check');