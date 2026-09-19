const { body } = require('express-validator');

/**
 * Validation rules for creating a job description (paste)
 */
const createJd = [
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('roleTitle')
    .trim()
    .notEmpty()
    .withMessage('Role title is required')
    .isLength({ max: 150 })
    .withMessage('Role title cannot exceed 150 characters'),
  body('rawText')
    .notEmpty()
    .withMessage('Raw job description text is required')
    .isString()
    .withMessage('Raw job description text must be a string')
    .custom((val) => val.trim().length >= 10)
    .withMessage('Job description text must contain at least 10 characters'),
  body('source')
    .optional()
    .isIn(['paste', 'url'])
    .withMessage('Source must be either "paste" or "url"'),
];

/**
 * Validation rules for scraping a job description from a URL
 */
const createJdFromUrl = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('A valid HTTP/HTTPS URL is required'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('roleTitle')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Role title cannot exceed 150 characters'),
];

module.exports = {
  createJd,
  createJdFromUrl,
};

