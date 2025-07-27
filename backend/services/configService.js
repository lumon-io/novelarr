const { getDb } = require('../db/database');
const crypto = require('crypto');

class ConfigService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
  }

  // Get a configuration value with caching
  get(key, defaultValue = '') {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    try {
      const db = getDb();
      const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      const value = result ? result.value : defaultValue;
      
      // Cache the result
      this.cache.set(key, {
        value,
        expires: Date.now() + this.cacheTimeout
      });
      
      return value;
    } catch (error) {
      console.error(`Failed to get config ${key}:`, error);
      return defaultValue;
    }
  }

  // Get multiple config values at once
  getMultiple(keys) {
    try {
      const db = getDb();
      const placeholders = keys.map(() => '?').join(',');
      const results = db.prepare(
        `SELECT key, value FROM settings WHERE key IN (${placeholders})`
      ).all(...keys);
      
      const config = {};
      keys.forEach(key => {
        config[key] = '';
      });
      
      results.forEach(row => {
        config[row.key] = row.value;
      });
      
      return config;
    } catch (error) {
      console.error('Failed to get multiple configs:', error);
      return {};
    }
  }

  // Update a configuration value
  set(key, value) {
    try {
      const db = getDb();
      db.prepare(
        'UPDATE settings SET value = ? WHERE key = ?'
      ).run(value, key);
      
      // Clear cache for this key
      this.cache.delete(key);
      
      return true;
    } catch (error) {
      console.error(`Failed to set config ${key}:`, error);
      return false;
    }
  }

  // Clear the entire cache
  clearCache() {
    this.cache.clear();
  }

  // Get all settings organized by category
  getAllByCategory() {
    try {
      const db = getDb();
      const settings = db.prepare(`
        SELECT s.*, c.display_name as category_name, c.sort_order
        FROM settings s
        LEFT JOIN setting_categories c ON s.category = c.name
        ORDER BY c.sort_order, s.key
      `).all();
      
      const grouped = {};
      settings.forEach(setting => {
        const category = setting.category || 'general';
        if (!grouped[category]) {
          grouped[category] = {
            name: setting.category_name || category,
            settings: []
          };
        }
        grouped[category].settings.push({
          key: setting.key,
          value: setting.value,
          description: setting.description
        });
      });
      
      return grouped;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  }

  // Initialize missing settings with defaults
  initializeDefaults() {
    const defaults = {
      'session_secret': () => crypto.randomBytes(32).toString('hex'),
      'smtp_port': '587',
      'smtp_secure': 'tls',
      'smtp_from_name': 'Novelarr',
      'kindle_email_domain': '@kindle.com',
      'api_rate_limit_window': '60000',
      'api_rate_limit_max_requests': '300',
      'session_timeout': '604800000',
      'max_login_attempts': '5',
      'lockout_duration': '900000',
      'log_level': 'info'
    };

    try {
      const db = getDb();
      Object.entries(defaults).forEach(([key, value]) => {
        const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        if (!existing || !existing.value) {
          const defaultValue = typeof value === 'function' ? value() : value;
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(defaultValue, key);
        }
      });
    } catch (error) {
      console.error('Failed to initialize defaults:', error);
    }
  }
}

module.exports = new ConfigService();