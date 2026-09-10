const fs = require('fs');
const Resume = require('../models/Resume');
const parseDocument = require('../services/parsers');
const { extractSections } = parseDocument;

/**
 * Upload and parse a resume file (PDF or DOCX)
 * POST /api/resumes
 * Protected route, multipart/form-data
 */
const uploadResume = async (req, res) => {
  try {
    // 1. Ensure file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'File required',
        message:
          'No resume file uploaded. Please provide a file with field name "file" or "resume".',
      });
    }

    // 2. Read buffer from memory or disk
    let buffer = req.file.buffer;
    if (!buffer && req.file.path) {
      try {
        buffer = await fs.promises.readFile(req.file.path);
      } catch (readErr) {
        console.error('Failed to read uploaded resume file:', readErr);
        return res.status(500).json({
          error: 'Read error',
          message: 'Failed to read uploaded file from server storage',
        });
      }
    }

    if (!buffer || buffer.length === 0) {
      if (req.file.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'Empty file',
        message: 'The uploaded file is empty',
      });
    }

    // 3. Parse raw text from document buffer
    let rawText = '';
    try {
      rawText = await parseDocument(buffer, req.file.mimetype, req.file.originalname);
    } catch (parseErr) {
      if (req.file.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'Parse error',
        message: parseErr.message || 'Failed to extract text from document',
      });
    }

    // 4. Extract structured sections
    let parsedSections = {};
    try {
      parsedSections = extractSections(rawText);
    } catch (extractErr) {
      console.warn('Section extractor warning:', extractErr.message);
      parsedSections = {};
    }

    // 5. Create and save Resume in MongoDB
    const resume = new Resume({
      userId: req.user._id,
      originalFilename: req.file.originalname,
      rawText,
      parsedSections,
      uploadedAt: new Date(),
      filePath: req.file.path || '',
      fileSize: req.file.size || buffer.length,
      mimeType: req.file.mimetype || '',
    });

    await resume.save();

    // 6. Return response matching resume object
    const resumeJson = resume.toJSON();

    return res.status(201).json({
      ...resumeJson,
      resume: resumeJson,
    });
  } catch (error) {
    // Clean up uploaded file if disk write succeeded before error
    if (req.file && req.file.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }

    console.error('Resume upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to upload and parse resume',
    });
  }
};

module.exports = {
  uploadResume,
};
