-- Create table to track Kindle sends
CREATE TABLE IF NOT EXISTS kindle_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    request_id INTEGER NOT NULL,
    kindle_email TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kindle_sends_user_id ON kindle_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_kindle_sends_request_id ON kindle_sends(request_id);