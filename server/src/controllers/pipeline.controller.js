const crypto = require('crypto');
const mongoose = require('mongoose');
const { MemorySaver } = require('@langchain/langgraph');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const { createApplicationPipeline } = require('../agents/pipeline');

// In-memory shared checkpointer and run registry
let sharedCheckpointer = new MemorySaver();
let runsStore = new Map();
let pipelineInstance = createApplicationPipeline({
  checkpointer: sharedCheckpointer,
  allowFallback: true,
});

/**
 * Gets the current pipeline instance.
 * @returns {Object} LangGraph runnable pipeline
 */
function getPipelineInstance() {
  return pipelineInstance;
}

/**
 * Overrides the pipeline instance (primarily for tests/mock LLMs).
 * @param {Object} instance - Custom pipeline instance
 */
function setPipelineInstance(instance) {
  pipelineInstance = instance;
}

/**
 * Returns current runs store map.
 * @returns {Map}
 */
function getRunsStore() {
  return runsStore;
}

/**
 * Resets run store and checkpointer (for testing isolation).
 */
function resetRunsStore() {
  runsStore.clear();
  sharedCheckpointer = new MemorySaver();
  pipelineInstance = createApplicationPipeline({
    checkpointer: sharedCheckpointer,
    allowFallback: true,
  });
}

/**
 * POST /api/pipeline/run
 * Accepts { resumeId, jdId }, starts the multi-agent pipeline,
 * and halts at the human interrupt checkpoint.
 * Returns: { runId, state, status: 'awaiting_review' }
 */
async function runPipeline(req, res) {
  try {
    const { resumeId, jdId } = req.body;

    // 1. Fetch and validate Resume document
    const resumeDoc = await Resume.findById(resumeId);
    if (!resumeDoc) {
      return res.status(404).json({
        error: 'Resume not found',
        message: `Resume with ID "${resumeId}" was not found`,
      });
    }

    // Ownership check
    if (req.user && resumeDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resume',
      });
    }

    // 2. Fetch and validate Job Description document
    const jdDoc = await JobDescription.findById(jdId);
    if (!jdDoc) {
      return res.status(404).json({
        error: 'Job description not found',
        message: `Job description with ID "${jdId}" was not found`,
      });
    }

    // Ownership check
    if (req.user && jdDoc.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this job description',
      });
    }

    // 3. Initialize run state
    const runId = crypto.randomUUID();
    const initialState = {
      resumeSections: resumeDoc.toJSON ? resumeDoc.toJSON() : resumeDoc,
      jdRequirements: jdDoc.toJSON ? jdDoc.toJSON() : jdDoc,
      humanApproved: false,
      userEdits: null,
    };

    // 4. Invoke pipeline execution up to __human_interrupt__ checkpoint
    const currentPipeline = getPipelineInstance();
    const config = { configurable: { thread_id: runId } };

    const checkpointState = await currentPipeline.invoke(initialState, config);

    // 5. Store run in registry
    const runRecord = {
      runId,
      userId: req.user ? req.user._id.toString() : null,
      resumeId,
      jdId,
      status: 'awaiting_review',
      state: checkpointState,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    runsStore.set(runId, runRecord);

    // 6. Return response
    return res.status(201).json({
      runId,
      state: checkpointState,
      status: 'awaiting_review',
    });
  } catch (error) {
    console.error('[PipelineController] Error running pipeline:', error);
    return res.status(500).json({
      error: 'Pipeline execution failed',
      message: error.message,
    });
  }
}

/**
 * GET /api/pipeline/:runId
 * Retrieves current state and status for a pipeline run.
 */
async function getPipelineStatus(req, res) {
  try {
    const { runId } = req.params;
    const runRecord = runsStore.get(runId);

    if (!runRecord) {
      return res.status(404).json({
        error: 'Pipeline run not found',
        message: `No pipeline run found with ID "${runId}"`,
      });
    }

    // Ownership check
    if (req.user && runRecord.userId && runRecord.userId !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view this pipeline run',
      });
    }

    return res.status(200).json({
      runId: runRecord.runId,
      state: runRecord.state,
      status: runRecord.status,
    });
  } catch (error) {
    console.error('[PipelineController] Error getting pipeline status:', error);
    return res.status(500).json({
      error: 'Failed to retrieve pipeline run',
      message: error.message,
    });
  }
}

/**
 * POST /api/pipeline/:runId/approve
 * Resumes graph with human approval: routes to save node.
 */
async function approvePipeline(req, res) {
  try {
    const { runId } = req.params;
    const runRecord = runsStore.get(runId);

    if (!runRecord) {
      return res.status(404).json({
        error: 'Pipeline run not found',
        message: `No pipeline run found with ID "${runId}"`,
      });
    }

    // Ownership check
    if (req.user && runRecord.userId && runRecord.userId !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to approve this pipeline run',
      });
    }

    // Resume graph execution with approval
    const currentPipeline = getPipelineInstance();
    const config = { configurable: { thread_id: runId } };

    await currentPipeline.updateState(config, { humanApproved: true });
    const finalState = await currentPipeline.invoke(null, config);

    // Update run registry
    runRecord.state = finalState;
    runRecord.status = finalState.status || 'saved';
    runRecord.updatedAt = new Date();

    return res.status(200).json({
      runId: runRecord.runId,
      state: finalState,
      status: runRecord.status,
    });
  } catch (error) {
    console.error('[PipelineController] Error approving pipeline:', error);
    return res.status(500).json({
      error: 'Failed to approve pipeline run',
      message: error.message,
    });
  }
}

/**
 * POST /api/pipeline/:runId/edit
 * Resumes graph with user edits: routes back to resume tailoring.
 */
async function editPipeline(req, res) {
  try {
    const { runId } = req.params;
    const runRecord = runsStore.get(runId);

    if (!runRecord) {
      return res.status(404).json({
        error: 'Pipeline run not found',
        message: `No pipeline run found with ID "${runId}"`,
      });
    }

    // Ownership check
    if (req.user && runRecord.userId && runRecord.userId !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit this pipeline run',
      });
    }

    const userEdits = req.body.userEdits || req.body.edits || req.body;

    // Resume graph execution with loop-back
    const currentPipeline = getPipelineInstance();
    const config = { configurable: { thread_id: runId } };

    await currentPipeline.updateState(config, {
      humanApproved: false,
      userEdits,
    });
    const revisedState = await currentPipeline.invoke(null, config);

    // Update run registry
    runRecord.state = revisedState;
    runRecord.status = 'awaiting_review';
    runRecord.updatedAt = new Date();

    return res.status(200).json({
      runId: runRecord.runId,
      state: revisedState,
      status: 'awaiting_review',
    });
  } catch (error) {
    console.error('[PipelineController] Error editing pipeline:', error);
    return res.status(500).json({
      error: 'Failed to update pipeline run with edits',
      message: error.message,
    });
  }
}

module.exports = {
  runPipeline,
  getPipelineStatus,
  approvePipeline,
  editPipeline,
  getPipelineInstance,
  setPipelineInstance,
  getRunsStore,
  resetRunsStore,
};
