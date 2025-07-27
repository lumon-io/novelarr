-- Add Goodreads and OpenAI settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
('goodreads_api_key', '', 'Goodreads API key for OAuth authentication'),
('goodreads_api_secret', '', 'Goodreads API secret for OAuth authentication'),
('goodreads_callback_url', 'http://localhost:8096/api/goodreads/callback', 'OAuth callback URL (update with your domain)'),
('openai_api_key', '', 'OpenAI API key for AI recommendations'),
('openai_model', 'gpt-4-turbo-preview', 'OpenAI model to use for recommendations'),
('ai_recommendations_enabled', 'false', 'Enable AI-powered book recommendations');