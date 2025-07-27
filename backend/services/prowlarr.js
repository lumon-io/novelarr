const axios = require('axios');
const { getDb } = require('../db/database');

class ProwlarrService {
  constructor() {
    this.updateConfig();
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('prowlarr_enabled', 'prowlarr_url', 'prowlarr_api_key');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.prowlarr_enabled === 'true';
    this.url = config.prowlarr_url || '';
    this.apiKey = config.prowlarr_api_key || '';
    
    if (this.enabled && this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        timeout: 60000, // 60 second timeout for Prowlarr
        headers: {
          'X-Api-Key': this.apiKey
        }
      });
    }
  }

  async search(query) {
    this.updateConfig(); // Refresh config before search
    
    if (!this.enabled || !this.client) {
      throw new Error('Prowlarr is not configured');
    }

    console.log('Prowlarr search starting for:', query);
    const startTime = Date.now();

    try {
      // Search using Prowlarr's search API - just query parameter
      const response = await this.client.get('/api/v1/search', {
        params: {
          query: query
        }
      });
      
      // Transform Prowlarr results to our format
      const results = response.data || [];
      
      // Filter for book-related categories
      const bookResults = results.filter(item => {
        // If no categories, include it (might be a book)
        if (!item.categories || item.categories.length === 0) return true;
        
        // Check for book-related categories
        return item.categories.some(cat => 
          cat.id === 3030 || // Audio/Audiobook
          cat.id === 7000 || // Books
          cat.id === 7010 || // Books/Mags
          cat.id === 7020 || // Books/EBook
          cat.id === 7030 || // Books/Comics
          cat.id === 7040 || // Books/Technical
          cat.id === 7050 || // Books/Other
          cat.id === 7060 || // Books/Magazines
          cat.id === 8010 || // Books/Ebook
          (cat.id >= 100000 && cat.id < 200000) // Custom book categories
        );
      });
      
      const searchTime = Date.now() - startTime;
      console.log(`Prowlarr search completed in ${searchTime}ms, found ${bookResults.length} book results`);
      
      return bookResults.slice(0, 50).map(item => ({
        // Use GUID as unique ID
        goodreadsId: `prowlarr-${item.guid}`,
        title: item.title || 'Unknown Title',
        author: this.extractAuthor(item.title) || 'Unknown Author',
        year: item.publishDate ? new Date(item.publishDate).getFullYear() : null,
        coverUrl: '/placeholder.jpg', // Prowlarr doesn't provide covers
        overview: item.categories?.map(c => c.name).join(', ') || '',
        ratings: 0, // Prowlarr doesn't provide ratings
        pageCount: 0, // Prowlarr doesn't provide page count
        source: 'Prowlarr',
        size: this.formatSize(item.size),
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        indexer: item.indexer || 'Unknown',
        downloadUrl: item.downloadUrl,
        infoUrl: item.infoUrl,
        files: item.files || 0
      }));
    } catch (error) {
      console.error('Prowlarr search error:', error.message);
      throw new Error('Failed to search Prowlarr: ' + error.message);
    }
  }

  extractAuthor(title) {
    // Try to extract author from title patterns
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
      await this.client.get('/api/v1/health');
      return true;
    } catch (error) {
      console.error('Prowlarr test failed:', error.message);
      return false;
    }
  }

  async getIndexers() {
    this.updateConfig();
    
    if (!this.enabled || !this.client) {
      throw new Error('Prowlarr is not configured');
    }

    try {
      const response = await this.client.get('/api/v1/indexer');
      return response.data;
    } catch (error) {
      console.error('Failed to get Prowlarr indexers:', error.message);
      throw new Error('Failed to get indexers');
    }
  }
}

module.exports = new ProwlarrService();