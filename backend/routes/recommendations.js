const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/aiRecommendations');
const { getDb } = require('../db/database');

// Get AI recommendations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, refresh = false } = req.query;
    
    if (refresh) {
      // Clear cache to force refresh
      const db = getDb();
      db.prepare(
        'DELETE FROM recommendation_cache WHERE user_id = ? AND cache_key = ?'
      ).run(req.user.id, `recommendations_${limit}`);
    }
    
    const recommendations = await aiService.getRecommendations(
      req.user.id, 
      parseInt(limit)
    );
    
    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get personalized assessment for a specific book
router.get('/assess/:bookId', authenticateToken, async (req, res) => {
  try {
    const assessment = await aiService.getPersonalizedRecommendation(
      req.user.id,
      req.params.bookId
    );
    
    res.json(assessment);
  } catch (error) {
    console.error('Book assessment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommendation stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Get recommendation counts and cache status
    const stats = db.prepare(
      `SELECT 
        COUNT(DISTINCT book_id) as total_recommendations,
        COUNT(DISTINCT CASE WHEN score >= 0.8 THEN book_id END) as high_match_count,
        MIN(created_at) as first_recommendation,
        MAX(created_at) as latest_recommendation
       FROM ai_recommendations 
       WHERE user_id = ? AND expires_at > datetime('now')`
    ).get(req.user.id);
    
    // Get cache info
    const cacheInfo = db.prepare(
      `SELECT cache_key, created_at, expires_at
       FROM recommendation_cache 
       WHERE user_id = ? AND expires_at > datetime('now')`
    ).all(req.user.id);
    
    res.json({
      ...stats,
      caches: cacheInfo
    });
  } catch (error) {
    console.error('Recommendation stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear recommendation cache
router.delete('/cache', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    // Clear all caches for user
    db.prepare(
      'DELETE FROM recommendation_cache WHERE user_id = ?'
    ).run(req.user.id);
    
    // Clear expired recommendations
    db.prepare(
      'DELETE FROM ai_recommendations WHERE user_id = ? AND expires_at <= datetime("now")'
    ).run(req.user.id);
    
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommended books by genre
router.get('/by-genre', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    
    const recommendations = db.prepare(
      `SELECT 
        g.name as genre,
        b.id, b.title, a.name as author_name, b.cover_url,
        ar.score, ar.reasoning
       FROM ai_recommendations ar
       JOIN books b ON ar.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       LEFT JOIN book_genres bg ON b.id = bg.book_id
       LEFT JOIN genres g ON bg.genre_id = g.id
       WHERE ar.user_id = ? AND ar.expires_at > datetime('now')
       ORDER BY g.name, ar.score DESC`
    ).all(req.user.id);
    
    // Group by genre
    const byGenre = {};
    recommendations.forEach(rec => {
      const genre = rec.genre || 'Uncategorized';
      if (!byGenre[genre]) {
        byGenre[genre] = [];
      }
      byGenre[genre].push({
        id: rec.id,
        title: rec.title,
        author: rec.author_name,
        coverUrl: rec.cover_url,
        score: rec.score,
        reasoning: rec.reasoning
      });
    });
    
    res.json(byGenre);
  } catch (error) {
    console.error('Get recommendations by genre error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export recommendations
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const db = getDb();
    
    const recommendations = db.prepare(
      `SELECT 
        b.title, a.name as author, b.isbn, b.goodreads_id,
        b.description, b.publication_date, b.page_count,
        ar.score, ar.reasoning, ar.created_at as recommended_at
       FROM ai_recommendations ar
       JOIN books b ON ar.book_id = b.id
       JOIN authors a ON b.author_id = a.id
       WHERE ar.user_id = ? AND ar.expires_at > datetime('now')
       ORDER BY ar.score DESC`
    ).all(req.user.id);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Title,Author,ISBN,Goodreads ID,Score,Reasoning,Recommended At',
        ...recommendations.map(r => 
          `"${r.title}","${r.author}","${r.isbn || ''}","${r.goodreads_id || ''}",${r.score},"${r.reasoning}","${r.recommended_at}"`
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="novelarr-recommendations.csv"');
      res.send(csv);
    } else {
      res.json(recommendations);
    }
  } catch (error) {
    console.error('Export recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;