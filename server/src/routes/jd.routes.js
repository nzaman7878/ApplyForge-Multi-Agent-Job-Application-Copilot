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

module.exports = router;
