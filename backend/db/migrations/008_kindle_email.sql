-- Add kindle_email field to users table
ALTER TABLE users ADD COLUMN kindle_email TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_kindle_email ON users(kindle_email);