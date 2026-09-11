const JobDescription = require('../models/JobDescription');
const parseDocument = require('../services/parsers');
const parseJobDescription =
  parseDocument.parseJobDescription || require('../services/parsers/jdParser');

/**
 * Create and parse a new job description from pasted text
 * POST /api/jds
 * Protected route
 */
const createJobDescription = async (req, res) => {
  try {
    const { company, roleTitle, rawText, source } = req.body;

    // Safety fallback validation in case validator middleware was bypassed
    if (!company || !roleTitle || !rawText) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Company, role title, and raw job description text are required',
      });
    }

    if (typeof rawText !== 'string' || rawText.trim().length < 10) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Raw job description text must contain at least 10 characters',
      });
    }

    // 1. Extract structured requirements from raw JD text
    let parsedRequirements = {
      skills: [],
      experience: [],
      qualifications: [],
      niceToHave: [],
    };

    try {
      parsedRequirements = parseJobDescription(rawText);
    } catch (parseErr) {
      console.warn('JD parser warning, using default structure:', parseErr.message);
    }

    // 2. Instantiate and persist JobDescription model in MongoDB
    const jobDescription = new JobDescription({
      userId: req.user._id,
      company: company.trim(),
      roleTitle: roleTitle.trim(),
      rawText: rawText.trim(),
      parsedRequirements,
      source: source === 'url' ? 'url' : 'paste',
      createdAt: new Date(),
    });

    await jobDescription.save();

    // 3. Return formatted response (HTTP 201 Created)
    const jdJson = jobDescription.toJSON();

    return res.status(201).json({
      ...jdJson,
      jobDescription: jdJson,
    });
  } catch (error) {
    console.error('Create job description error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create and parse job description',
    });
  }
};

module.exports = {
  createJobDescription,
  createJd: createJobDescription,
};
