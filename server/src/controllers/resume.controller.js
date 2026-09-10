const fs = require('fs');
const mongoose = require('mongoose');
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

/**
 * List all resumes for the authenticated user
 * GET /api/resumes
 * Protected route
 */
const getResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user._id })
      .sort({ uploadedAt: -1 })
      .select('originalFilename uploadedAt createdAt');

    const formattedResumes = resumes.map((resume) => ({
      id: resume._id.toString(),
      name: resume.originalFilename,
      originalFilename: resume.originalFilename,
      uploadedAt: resume.uploadedAt,
      createdAt: resume.createdAt,
    }));

    if (req.query.wrap === 'true' || req.query.format === 'object') {
      return res.status(200).json({
        resumes: formattedResumes,
        count: formattedResumes.length,
      });
    }

    return res.status(200).json(formattedResumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve resumes',
    });
  }
};

/**
 * Get single resume by ID with full parsed sections
 * GET /api/resumes/:id
 * Protected route
 */
const getResumeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'The provided resume ID is invalid',
        code: 'INVALID_RESUME_ID',
      });
    }

    const resume = await Resume.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({
        error: 'Resume not found',
        message: 'Resume not found or access denied',
        code: 'RESUME_NOT_FOUND',
      });
    }

    const resumeJson = resume.toJSON();

    return res.status(200).json({
      ...resumeJson,
      resume: resumeJson,
    });
  } catch (error) {
    console.error('Get resume by ID error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve resume details',
    });
  }
};

/**
 * Delete a resume by ID with ownership guard and disk cleanup
 * DELETE /api/resumes/:id
 * Protected route
 */
const deleteResume = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'The provided resume ID is invalid',
        code: 'INVALID_RESUME_ID',
      });
    }

    // Ownership guard: find document belonging specifically to authenticated user
    const resume = await Resume.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!resume) {
      return res.status(404).json({
        error: 'Resume not found',
        message: 'Resume not found or access denied',
        code: 'RESUME_NOT_FOUND',
      });
    }

    // Delete file from disk if path exists
    if (resume.filePath) {
      try {
        if (fs.existsSync(resume.filePath)) {
          await fs.promises.unlink(resume.filePath);
        }
      } catch (fileErr) {
        console.warn(
          `Warning: Failed to delete resume file from disk (${resume.filePath}):`,
          fileErr.message
        );
      }
    }

    // Delete MongoDB document
    await Resume.deleteOne({ _id: resume._id });

    return res.status(200).json({
      message: 'Resume deleted successfully',
      id: resume._id.toString(),
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete resume',
    });
  }
};

module.exports = {
  uploadResume,
  getResumes,
  getResumeById,
  deleteResume,
};
