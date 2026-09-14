const { body, query } = require('express-validator');

const VALID_STATUSES = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected'];

/**
 * Validation rules for creating an application manually or via pipeline
 */
const createApplication = [
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
  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('appliedAt')
    .optional()
    .isISO8601()
    .withMessage('appliedAt must be a valid ISO8601 date'),
  body('lastFollowUpAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('lastFollowUpAt must be a valid ISO8601 date'),
  body('nextFollowUpAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('nextFollowUpAt must be a valid ISO8601 date'),
];

/**
 * Validation rules for updating an application (PATCH / PUT)
 */
const updateApplication = [
  body('company')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company name cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Company name cannot exceed 150 characters'),
  body('roleTitle')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Role title cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Role title cannot exceed 150 characters'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('appliedAt')
    .optional()
    .isISO8601()
    .withMessage('appliedAt must be a valid ISO8601 date'),
  body('lastFollowUpAt')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      return !isNaN(Date.parse(val));
    })
    .withMessage('lastFollowUpAt must be a valid date or null'),
  body('nextFollowUpAt')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '') return true;
      return !isNaN(Date.parse(val));
    })
    .withMessage('nextFollowUpAt must be a valid date or null'),
];

/**
 * Query parameter validations for listing applications
 */
const listApplications = [
  query('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
];

module.exports = {
  createApplication,
  updateApplication,
  listApplications,
  VALID_STATUSES,
};
