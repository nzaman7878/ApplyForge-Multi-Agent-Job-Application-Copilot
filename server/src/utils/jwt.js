const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a JWT token for a user
 * @param {string|ObjectId} userId - The user ID to sign
 * @returns {string} The signed JWT token
 */
const signToken = (userId) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not defined in the environment configuration.');
  }

  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiration,
  });
};

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @returns {Object} The decoded token payload
 */
const verifyToken = (token) => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not defined in the environment configuration.');
  }

  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  signToken,
  verifyToken,
};
