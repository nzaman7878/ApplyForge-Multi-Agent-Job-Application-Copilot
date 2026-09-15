const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analytics.controller');

// All analytics endpoints require authentication
router.use(auth);

// GET /api/analytics/summary — total applications, by-status counts, response rate, avg fit score
router.get('/summary', analyticsController.getSummary);

// GET /api/analytics/timeline — applications per week over last 12 weeks
router.get('/timeline', analyticsController.getTimeline);

// GET /api/analytics/score-vs-response — fit score bands vs callback rate
router.get('/score-vs-response', analyticsController.getScoreVsResponse);

module.exports = router;
