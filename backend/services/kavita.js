const axios = require('axios');
const { getDb } = require('../db/database');

class KavitaService {
  constructor() {
    this.enabled = false;
    this.url = '';
    this.apiKey = '';
    this.jwtToken = null;
    this.tokenExpiry = null;
  }

  updateConfig() {
    const db = getDb();
    const settings = db.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?)'
    ).all('kavita_url', 'kavita_api_key', 'kavita_enabled');
    
    const config = {};
    settings.forEach(s => config[s.key] = s.value);
    
    this.enabled = config.kavita_enabled === 'true';
    this.url = config.kavita_url || '';
    this.apiKey = config.kavita_api_key || '';
    this.jwtToken = null;
    this.tokenExpiry = null;
    
    if (this.enabled && this.url && this.apiKey) {
      this.client = axios.create({
        baseURL: this.url,
        timeout: 10000
      });
    }
  }

  async authenticate() {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Kavita is not configured');
    }

    // Check if we have a valid token
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }

    try {
      // Get JWT token using API key
      const response = await this.client.post('/api/Plugin/authenticate', {
        apiKey: this.apiKey
      });

      this.jwtToken = response.data.token;
      // JWT tokens typically expire in 24 hours
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      
      // Update axios instance with auth header
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.jwtToken}`;
      
      return this.jwtToken;
    } catch (error) {
      console.error('Kavita authentication failed:', error.message);
      throw new Error('Failed to authenticate with Kavita');
    }
  }

  async searchLibrary(query) {
    await this.authenticate();
    
    try {
      // Search series in Kavita
      const response = await this.client.get('/api/Series/search', {
        params: { queryString: query }
      });
      
      return response.data.map(series => ({
        id: series.id,
        name: series.name,
        libraryId: series.libraryId,
        coverImageUrl: `${this.url}/api/Image/series-cover?seriesId=${series.id}`,
        pagesRead: series.pagesRead,
        pages: series.pages,
        format: series.format,
        created: series.created,
        lastModified: series.lastModified,
        bookCount: series.bookCount || 0,
        inKavita: true
      }));
    } catch (error) {
      console.error('Kavita search error:', error.message);
      return [];
    }
  }

  async checkBookExists(title, author) {
    await this.authenticate();
    
    try {
      // Search for exact match
      const searchQuery = author ? `${title} ${author}` : title;
      const results = await this.searchLibrary(searchQuery);
      
      // Check for exact or close match
      return results.some(series => {
        const seriesName = series.name.toLowerCase();
        const searchTitle = title.toLowerCase();
        return seriesName.includes(searchTitle) || searchTitle.includes(seriesName);
      });
    } catch (error) {
      console.error('Kavita check book exists error:', error.message);
      return false;
    }
  }

  async getLibraries() {
    await this.authenticate();
    
    try {
      const response = await this.client.get('/api/Library');
      return response.data;
    } catch (error) {
      console.error('Failed to get Kavita libraries:', error.message);
      return [];
    }
  }

  async getSeries(seriesId) {
    await this.authenticate();
    
    try {
      const response = await this.client.get(`/api/Series/${seriesId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get series details:', error.message);
      return null;
    }
  }

  async getVolumes(seriesId) {
    await this.authenticate();
    
    try {
      const response = await this.client.get(`/api/Series/volumes`, {
        params: { seriesId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get volumes:', error.message);
      return [];
    }
  }

  async refreshLibrary(libraryId) {
    await this.authenticate();
    
    try {
      const response = await this.client.post(`/api/Library/scan`, {
        libraryId: libraryId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to refresh library:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.authenticate();
      // Try to get libraries as a test
      const libraries = await this.getLibraries();
      return libraries.length >= 0; // Even 0 libraries is a valid response
    } catch (error) {
      console.error('Kavita connection test failed:', error.message);
      return false;
    }
  }

  // Helper to build Kavita reader URL
  getReaderUrl(seriesId, volumeId, chapterId) {
    if (!this.url) return null;
    return `${this.url}/library/${seriesId}/series/${seriesId}/volume/${volumeId}/chapter/${chapterId}`;
  }

  // Helper to build series URL
  getSeriesUrl(libraryId, seriesId) {
    if (!this.url) return null;
    return `${this.url}/library/${libraryId}/series/${seriesId}`;
  }
}

module.exports = new KavitaService();