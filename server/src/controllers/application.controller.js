const mongoose = require('mongoose');
const Application = require('../models/Application');
const PipelineRun = require('../models/PipelineRun');

/**
 * POST /api/applications
 * Creates a new job application record (triggered by pipeline approve or manual input).
 */
async function createApplication(req, res) {
  try {
    const userId = req.user._id;
    const {
      company,
      roleTitle,
      jobDescription,
      tailoredResume,
      tailoredBullets,
      coverLetter,
      atsReport,
      fitScore,
      status,
      appliedAt,
      lastFollowUpAt,
      nextFollowUpAt,
      userEdits,
      notes,
      resumeId,
      jdId,
      pipelineRunId,
      runId,
    } = req.body;

    const application = new Application({
      userId,
      company,
      roleTitle,
      jobDescription: jobDescription || '',
      tailoredResume: tailoredResume || tailoredBullets || [],
      tailoredBullets: tailoredBullets || (Array.isArray(tailoredResume) ? tailoredResume : []),
      coverLetter: coverLetter || null,
      atsReport: atsReport || null,
      fitScore: fitScore || null,
      status: status || 'applied',
      appliedAt: appliedAt || Date.now(),
      lastFollowUpAt: lastFollowUpAt || null,
      nextFollowUpAt: nextFollowUpAt || null,
      userEdits: userEdits || null,
      notes: notes || '',
      resumeId: resumeId || null,
      jdId: jdId || null,
      pipelineRunId: pipelineRunId || null,
      runId: runId || null,
    });

    await application.save();

    // Link application to PipelineRun if reference is provided
    if (pipelineRunId && mongoose.Types.ObjectId.isValid(pipelineRunId)) {
      await PipelineRun.findByIdAndUpdate(pipelineRunId, {
        applicationId: application._id,
        status: 'saved',
      });
    } else if (runId) {
      await PipelineRun.findOneAndUpdate(
        { runId },
        { applicationId: application._id, status: 'saved' }
      );
    }

    return res.status(201).json({
      message: 'Application created successfully',
      application,
    });
  } catch (error) {
    console.error('[ApplicationController] Error creating application:', error);
    return res.status(500).json({
      error: 'Failed to create application',
      message: error.message,
    });
  }
}

/**
 * GET /api/applications
 * Returns a paginated list of applications for the authenticated user,
 * with optional filtering by status and text search.
 */
async function getApplications(req, res) {
  try {
    const userId = req.user._id;
    const { status, search } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { userId };
    if (status) {
      filter.status = status;
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ company: searchRegex }, { roleTitle: searchRegex }];
    }

    const [total, applications] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('resumeId', 'originalFilename formattedName')
        .populate('jdId', 'company roleTitle')
        .populate('pipelineRunId', 'runId status'),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      count: applications.length,
      total,
      page,
      totalPages,
      limit,
      applications,
    });
  } catch (error) {
    console.error('[ApplicationController] Error fetching applications:', error);
    return res.status(500).json({
      error: 'Failed to retrieve applications',
      message: error.message,
    });
  }
}

/**
 * GET /api/applications/:id
 * Retrieves full application details by MongoDB _id or pipeline runId.
 */
async function getApplicationById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    let application = null;

    // 1. Try finding by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      application = await Application.findById(id)
        .populate('resumeId', 'originalFilename formattedName sections')
        .populate('jdId', 'company roleTitle rawText requirements')
        .populate('pipelineRunId');
    }

    // 2. Try finding by runId string if not found
    if (!application) {
      application = await Application.findOne({ runId: id })
        .populate('resumeId', 'originalFilename formattedName sections')
        .populate('jdId', 'company roleTitle rawText requirements')
        .populate('pipelineRunId');
    }

    // 3. Fallback: If not in Application collection, check PipelineRun directly
    if (!application) {
      const pipelineRun = await PipelineRun.findOne({
        $or: [
          { runId: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      })
        .populate('resumeId', 'originalFilename formattedName sections')
        .populate('jdId', 'company roleTitle rawText requirements');

      if (pipelineRun) {
        if (pipelineRun.userId && pipelineRun.userId.toString() !== userId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have access to this application',
          });
        }

        // Synthesize application object from pipeline state
        const state = pipelineRun.state || {};
        return res.status(200).json({
          application: {
            id: pipelineRun._id,
            _id: pipelineRun._id,
            runId: pipelineRun.runId,
            company: pipelineRun.jdId?.company || state.structuredJD?.company || 'Target Company',
            roleTitle: pipelineRun.jdId?.roleTitle || state.structuredJD?.roleTitle || 'Target Role',
            status: pipelineRun.status === 'saved' ? 'applied' : pipelineRun.status,
            resumeId: pipelineRun.resumeId,
            jdId: pipelineRun.jdId,
            pipelineRunId: pipelineRun._id,
            jobDescription: pipelineRun.jdId?.rawText || state.structuredJD || '',
            tailoredResume: state.tailoredBullets || state.tailoredResume || [],
            tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
            coverLetter: state.coverLetter || null,
            fitScore: state.fitScore || null,
            atsReport: state.atsReport || null,
            appliedAt: pipelineRun.updatedAt || pipelineRun.createdAt,
            appliedDate: pipelineRun.updatedAt || pipelineRun.createdAt,
            lastFollowUpAt: null,
            nextFollowUpAt: null,
            userEdits: state.userEdits || null,
            notes: '',
            createdAt: pipelineRun.createdAt,
            updatedAt: pipelineRun.updatedAt,
          },
        });
      }

      return res.status(404).json({
        error: 'Application not found',
        message: `No application found matching ID "${id}"`,
      });
    }

    // Ownership check
    if (application.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this application',
      });
    }

    return res.status(200).json({
      application,
    });
  } catch (error) {
    console.error('[ApplicationController] Error retrieving application:', error);
    return res.status(500).json({
      error: 'Failed to retrieve application',
      message: error.message,
    });
  }
}

/**
 * PATCH & PUT /api/applications/:id
 * Updates an application's status, follow-up dates, notes, or application content.
 */
async function updateApplication(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const updates = req.body;

    let application = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      application = await Application.findById(id);
    }
    if (!application) {
      application = await Application.findOne({ runId: id });
    }

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: `No application found matching ID "${id}"`,
      });
    }

    if (application.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this application',
      });
    }

    // Apply allowed update fields
    const allowedFields = [
      'status',
      'company',
      'roleTitle',
      'notes',
      'appliedAt',
      'appliedDate',
      'lastFollowUpAt',
      'nextFollowUpAt',
      'jobDescription',
      'tailoredResume',
      'tailoredBullets',
      'coverLetter',
      'atsReport',
      'fitScore',
      'userEdits',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        application[field] = updates[field];
      }
    }

    await application.save();

    return res.status(200).json({
      message: 'Application updated successfully',
      application,
    });
  } catch (error) {
    console.error('[ApplicationController] Error updating application:', error);
    return res.status(500).json({
      error: 'Failed to update application',
      message: error.message,
    });
  }
}

/**
 * DELETE /api/applications/:id
 * Deletes an application with user ownership protection.
 */
async function deleteApplication(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    let application = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      application = await Application.findById(id);
    }
    if (!application) {
      application = await Application.findOne({ runId: id });
    }

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: `No application found matching ID "${id}"`,
      });
    }

    if (application.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this application',
      });
    }

    await Application.findByIdAndDelete(application._id);

    return res.status(200).json({
      message: 'Application deleted successfully',
      id: application._id,
    });
  } catch (error) {
    console.error('[ApplicationController] Error deleting application:', error);
    return res.status(500).json({
      error: 'Failed to delete application',
      message: error.message,
    });
  }
}

/**
 * GET /api/applications/follow-ups/due
 * Retrieves all applications for the authenticated user where nextFollowUpAt is due (<= now).
 * Returns applications sorted in ascending order of nextFollowUpAt (most overdue first).
 */
async function getDueFollowUps(req, res) {
  try {
    const userId = req.user._id;
    const now = new Date();

    const applications = await Application.find({
      userId,
      nextFollowUpAt: { $ne: null, $lte: now },
    })
      .sort({ nextFollowUpAt: 1 })
      .populate('resumeId', 'originalFilename formattedName')
      .populate('jdId', 'company roleTitle')
      .populate('pipelineRunId', 'runId status');

    return res.status(200).json({
      count: applications.length,
      asOf: now.toISOString(),
      dueFollowUps: applications,
      applications,
    });
  } catch (error) {
    console.error('[ApplicationController] Error retrieving due follow-ups:', error);
    return res.status(500).json({
      error: 'Failed to retrieve due follow-ups',
      message: error.message,
    });
  }
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  getDueFollowUps,
};

