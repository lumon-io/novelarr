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

module.exports = new JackettService();