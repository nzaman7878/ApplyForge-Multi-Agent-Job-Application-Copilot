const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Rate limiter for login requests to prevent brute force attacks.
 * Allows 5 requests per 15 minutes per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 requests per 15 minutes
  standardHeaders: 'draft-7', // Return standard RateLimit-* headers
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
});

/**
 * Global API rate limiter to protect all /api/ endpoints against DoS and abusive scraping.
 * Defaults to 100 requests per 15 minutes per IP (configurable via RATE_LIMIT_MAX).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: config.rateLimitMax || 100, // Max requests per 15 min per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
