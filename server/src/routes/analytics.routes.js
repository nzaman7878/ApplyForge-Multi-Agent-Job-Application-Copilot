const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analytics.controller');
const { responseCache } = require('../middleware/cache');

// All analytics endpoints require authentication
router.use(auth);

// Response cache (TTL: 60s, per-user tenant isolation)
const analyticsCache = responseCache(60);

// GET /api/analytics/summary — total applications, by-status counts, response rate, avg fit score
router.get('/summary', analyticsCache, analyticsController.getSummary);

// GET /api/analytics/timeline — applications per week over last 12 weeks
router.get('/timeline', analyticsCache, analyticsController.getTimeline);

// GET /api/analytics/score-vs-response — fit score bands vs callback rate
router.get('/score-vs-response', analyticsCache, analyticsController.getScoreVsResponse);

module.exports = router;
