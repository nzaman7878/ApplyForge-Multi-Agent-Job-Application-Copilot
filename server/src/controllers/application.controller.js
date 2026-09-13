const mongoose = require('mongoose');
const Application = require('../models/Application');
const PipelineRun = require('../models/PipelineRun');

/**
 * GET /api/applications
 * Returns all applications for the authenticated user.
 */
async function getApplications(req, res) {
  try {
    const userId = req.user._id;
    const applications = await Application.find({ userId })
      .sort({ createdAt: -1 })
      .populate('resumeId', 'originalFilename formattedName')
      .populate('jdId', 'company roleTitle');

    return res.status(200).json({
      count: applications.length,
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
 * Retrieves a single application by MongoDB _id or pipeline runId.
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

        // Return synthesized application object from pipeline state
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
            tailoredBullets: state.tailoredBullets || state.tailoredResume || [],
            coverLetter: state.coverLetter || null,
            fitScore: state.fitScore || null,
            atsReport: state.atsReport || null,
            appliedDate: pipelineRun.updatedAt || pipelineRun.createdAt,
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
 * PUT /api/applications/:id
 * Updates an application's status or notes.
 */
async function updateApplication(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const { status, notes } = req.body;

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

    if (status) application.status = status;
    if (notes !== undefined) application.notes = notes;

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
 * Deletes an application.
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

module.exports = {
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
};
