const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login requests to prevent brute force attacks.
 * Allows 5 requests per 15 minutes per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 requests per 15 minutes
  standardHeaders: 'draft-7', // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
});

module.exports = {
  loginLimiter,
};
