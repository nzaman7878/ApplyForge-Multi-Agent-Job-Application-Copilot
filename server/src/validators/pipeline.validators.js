const { body, param } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Validation rules for starting a new pipeline run
 */
const runPipeline = [
  body('resumeId')
    .notEmpty()
    .withMessage('resumeId is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('resumeId must be a valid ObjectId'),
  body('jdId')
    .notEmpty()
    .withMessage('jdId is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('jdId must be a valid ObjectId'),
];

/**
 * Validation rules for runId parameter
 */
const runIdParam = [
  param('runId')
    .trim()
    .notEmpty()
    .withMessage('runId parameter is required'),
];

/**
 * Validation rules for editing a pipeline run
 */
const editPipeline = [
  param('runId')
    .trim()
    .notEmpty()
    .withMessage('runId parameter is required'),
  body()
    .custom((val) => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) {
        throw new Error('Request body must be a valid JSON object');
      }
      return true;
    }),
];

module.exports = {
  runPipeline,
  runIdParam,
  editPipeline,
};
