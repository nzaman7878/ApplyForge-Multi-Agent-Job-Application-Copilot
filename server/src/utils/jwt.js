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

/**
 * Generate a refresh token for a user
 * @param {string|ObjectId} userId - The user ID to sign
 * @returns {string} The signed JWT refresh token
 */
const signRefreshToken = (userId) => {
  const secret = config.jwt.refreshSecret || config.jwt.secret;
  if (!secret) {
    throw new Error('JWT secret is not defined in the environment configuration.');
  }

  return jwt.sign({ id: userId }, secret, {
    expiresIn: '30d',
  });
};

/**
 * Verify a refresh token
 * @param {string} token - The refresh token to verify
 * @returns {Object} The decoded token payload
 */
const verifyRefreshToken = (token) => {
  const secret = config.jwt.refreshSecret || config.jwt.secret;
  if (!secret) {
    throw new Error('JWT secret is not defined in the environment configuration.');
  }

  return jwt.verify(token, secret);
};

module.exports = {
  signToken,
  verifyToken,
  signRefreshToken,
  verifyRefreshToken,
};
