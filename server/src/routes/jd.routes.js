const express = require('express');
const jdController = require('../controllers/jd.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const jdValidators = require('../validators/jd.validators');

const router = express.Router();

/**
 * @route   POST /api/jds
 * @desc    Create and parse job description from pasted text
 * @access  Protected
 */
router.post('/', auth, validate(jdValidators.createJd), jdController.createJobDescription);

/**
 * @route   POST /api/jds/from-url
 * @desc    Scrape and create job description from URL
 * @access  Protected
 */
router.post(
  '/from-url',
  auth,
  validate(jdValidators.createJdFromUrl),
  jdController.createJobDescriptionFromUrl
);

/**
 * @route   GET /api/jds
 * @desc    List authenticated user's job descriptions
 * @access  Protected
 */
router.get('/', auth, jdController.getJobDescriptions);

/**
 * @route   GET /api/jds/:id
 * @desc    Get full job description by ID with parsed requirements
 * @access  Protected
 */
router.get('/:id', auth, jdController.getJobDescriptionById);

/**
 * @route   DELETE /api/jds/:id
 * @desc    Delete job description by ID (ownership protected)
 * @access  Protected
 */
router.delete('/:id', auth, jdController.deleteJobDescription);

module.exports = router;


