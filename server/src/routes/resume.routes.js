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

/**
 * @route   GET /api/resumes
 * @desc    List authenticated user's resumes
 * @access  Protected
 */
router.get('/', auth, resumeController.getResumes);

/**
 * @route   GET /api/resumes/:id
 * @desc    Get full resume by ID with parsed sections
 * @access  Protected
 */
router.get('/:id', auth, resumeController.getResumeById);

module.exports = router;
