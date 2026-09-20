const mongoose = require('mongoose');
const JobDescription = require('../models/JobDescription');
const parseDocument = require('../services/parsers');
const parseJobDescription =
  parseDocument.parseJobDescription || require('../services/parsers/jdParser');
const { scrapeJobDescription } = require('../services/scraper/jdScraper');

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
      sourceUrl: req.body.sourceUrl || null,
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

/**
 * Create and parse a new job description by scraping a job posting URL
 * POST /api/jds/from-url
 * Protected route
 */
const createJobDescriptionFromUrl = async (req, res) => {
  try {
    const {
      url,
      company: overrideCompany,
      roleTitle: overrideRoleTitle,
      preview,
    } = req.body || {};

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'A valid URL is required',
      });
    }

    // 1. Scrape job description content from URL
    let scraped;
    try {
      scraped = await scrapeJobDescription(url.trim());
    } catch (scrapeErr) {
      return res.status(422).json({
        error: 'Scrape error',
        message: `Failed to scrape job description from the provided URL: ${scrapeErr.message}`,
      });
    }

    if (!scraped || !scraped.rawText || scraped.rawText.trim().length < 10) {
      return res.status(422).json({
        error: 'Extraction error',
        message: 'Could not extract sufficient job description text from the provided URL',
      });
    }

    // If preview requested, return extracted metadata directly without persisting
    if (preview === true || req.query.preview === 'true') {
      return res.status(200).json({
        success: true,
        preview: true,
        company: (overrideCompany || scraped.company || '').trim(),
        roleTitle: (overrideRoleTitle || scraped.roleTitle || scraped.title || '').trim(),
        rawText: scraped.rawText.trim(),
        board: scraped.board,
        location: scraped.location,
        url: url.trim(),
      });
    }

    // 2. Resolve metadata (user overrides take precedence, then scraped fields, then fallbacks)
    const company = (overrideCompany || scraped.company || 'Unknown Company').trim();
    const roleTitle = (
      overrideRoleTitle ||
      scraped.roleTitle ||
      scraped.title ||
      'Open Position'
    ).trim();
    const rawText = scraped.rawText.trim();

    // 3. Extract structured requirements from raw text
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

    // 4. Instantiate and persist JobDescription model in MongoDB
    const jobDescription = new JobDescription({
      userId: req.user._id,
      company,
      roleTitle,
      rawText,
      parsedRequirements,
      source: 'url',
      sourceUrl: url.trim(),
      createdAt: new Date(),
    });

    await jobDescription.save();

    // 5. Return formatted response (HTTP 201 Created)
    const jdJson = jobDescription.toJSON();

    return res.status(201).json({
      ...jdJson,
      jobDescription: jdJson,
      metadata: {
        board: scraped.board,
        location: scraped.location,
      },
    });
  } catch (error) {
    console.error('Create JD from URL error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create job description from URL',
    });
  }
};

/**
 * List all job descriptions for the authenticated user
 * GET /api/jds
 * Protected route
 */
const getJobDescriptions = async (req, res) => {
  try {
    const jds = await JobDescription.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('company roleTitle source parsedRequirements createdAt updatedAt');

    const formattedJds = jds.map((jd) => {
      const json = jd.toJSON();
      return {
        ...json,
        id: jd._id.toString(),
      };
    });

    if (req.query.wrap === 'true' || req.query.format === 'object') {
      return res.status(200).json({
        jobDescriptions: formattedJds,
        jds: formattedJds,
        count: formattedJds.length,
      });
    }

    return res.status(200).json(formattedJds);
  } catch (error) {
    console.error('Get job descriptions error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve job descriptions',
    });
  }
};

/**
 * Get single job description by ID with full rawText and parsedRequirements
 * GET /api/jds/:id
 * Protected route
 */
const getJobDescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'The provided job description ID is invalid',
        code: 'INVALID_JD_ID',
      });
    }

    const jd = await JobDescription.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!jd) {
      return res.status(404).json({
        error: 'Job description not found',
        message: 'Job description not found or access denied',
        code: 'JD_NOT_FOUND',
      });
    }

    const jdJson = jd.toJSON();

    return res.status(200).json({
      ...jdJson,
      jobDescription: jdJson,
    });
  } catch (error) {
    console.error('Get job description by ID error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve job description details',
    });
  }
};

/**
 * Delete a job description by ID with ownership guard
 * DELETE /api/jds/:id
 * Protected route
 */
const deleteJobDescription = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'The provided job description ID is invalid',
        code: 'INVALID_JD_ID',
      });
    }

    // Ownership guard: find document belonging specifically to authenticated user
    const jd = await JobDescription.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!jd) {
      return res.status(404).json({
        error: 'Job description not found',
        message: 'Job description not found or access denied',
        code: 'JD_NOT_FOUND',
      });
    }

    // Delete MongoDB document
    await JobDescription.deleteOne({ _id: jd._id });

    return res.status(200).json({
      message: 'Job description deleted successfully',
      id: jd._id.toString(),
    });
  } catch (error) {
    console.error('Delete job description error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete job description',
    });
  }
};

module.exports = {
  createJobDescription,
  createJd: createJobDescription,
  createJobDescriptionFromUrl,
  getJobDescriptions,
  getJds: getJobDescriptions,
  getJobDescriptionById,
  getJdById: getJobDescriptionById,
  deleteJobDescription,
  deleteJd: deleteJobDescription,
};


