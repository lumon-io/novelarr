const express = require('express');
const router = express.Router();
const readarr = require('../services/readarr');
const jackett = require('../services/jackett');
const prowlarr = require('../services/prowlarr');
const kavita = require('../services/kavita');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { q, source = 'all' } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  const results = [];
  const errors = [];

  // Search Readarr
  if (source === 'all' || source === 'readarr') {
    try {
      const readarrResults = await readarr.search(q);
      results.push(...readarrResults);
    } catch (error) {
      console.error('Readarr search error:', error.message);
      errors.push({ source: 'readarr', error: error.message });
    }
  }

  // Search Jackett with timeout wrapper
  if (source === 'all' || source === 'jackett') {
    try {
      jackett.updateConfig(); // Refresh config
      if (jackett.enabled) {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Search timeout (10s)')), 10000);
        });
        
        // Race between search and timeout
        try {
          const jackettResults = await Promise.race([
            jackett.search(q),
            timeoutPromise
          ]);
          results.push(...jackettResults);
        } catch (timeoutError) {
          console.error('Jackett search timeout:', timeoutError.message);
          errors.push({ source: 'jackett', error: 'Search timed out after 10 seconds' });
        }
      }
    } catch (error) {
      console.error('Jackett search error:', error.message);
      errors.push({ source: 'jackett', error: error.message });
    }
  }

  // Search Prowlarr with timeout wrapper
  if (source === 'all' || source === 'prowlarr') {
    try {
      prowlarr.updateConfig(); // Refresh config
      if (prowlarr.enabled) {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Search timeout (15s)')), 15000);
        });
        
        // Race between search and timeout
        try {
          const prowlarrResults = await Promise.race([
            prowlarr.search(q),
            timeoutPromise
          ]);
          results.push(...prowlarrResults);
        } catch (timeoutError) {
          console.error('Prowlarr search timeout:', timeoutError.message);
          errors.push({ source: 'prowlarr', error: 'Search timed out after 15 seconds' });
        }
      }
    } catch (error) {
      console.error('Prowlarr search error:', error.message);
      errors.push({ source: 'prowlarr', error: error.message });
    }
  }

  // If no results and errors from all sources, return error
  if (results.length === 0 && errors.length > 0) {
    return res.status(500).json({ 
      error: 'All search sources failed', 
      details: errors 
    });
  }

  // Check Kavita library status if enabled
  if (kavita.enabled && results.length > 0) {
    try {
      kavita.updateConfig();
      // Check each book in Kavita
      const kavitaChecks = await Promise.all(
        results.map(async (book) => {
          const inKavita = await kavita.checkBookExists(book.title, book.author);
          return { ...book, inKavita };
        })
      );
      results = kavitaChecks;
    } catch (error) {
      console.error('Kavita check error:', error.message);
      // Continue without Kavita status
    }
  }

  res.json({ 
    results,
    errors: errors.length > 0 ? errors : undefined,
    sources: {
      readarr: true,
      jackett: jackett.enabled,
      prowlarr: prowlarr.enabled,
      kavita: kavita.enabled
    }
  });
});

// Get search sources status
router.get('/sources', requireAuth, async (req, res) => {
  jackett.updateConfig();
  prowlarr.updateConfig();
  kavita.updateConfig();
  
  const sources = {
    readarr: {
      enabled: true,
      connected: await readarr.testConnection()
    },
    jackett: {
      enabled: jackett.enabled,
      connected: jackett.enabled ? await jackett.testConnection() : false
    },
    prowlarr: {
      enabled: prowlarr.enabled,
      connected: prowlarr.enabled ? await prowlarr.testConnection() : false
    },
    kavita: {
      enabled: kavita.enabled,
      connected: kavita.enabled ? await kavita.testConnection() : false
    }
  };
  
  res.json(sources);
});

module.exports = router;