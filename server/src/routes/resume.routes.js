const express = require('express');
const resumeController = require('../controllers/resume.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

/**
 * @route   POST /api/resumes
 * @desc    Upload and parse resume file (PDF or DOCX)
 * @access  Protected
 */
router.post('/', auth, upload.handleResumeUpload, resumeController.uploadResume);

module.exports = router;
