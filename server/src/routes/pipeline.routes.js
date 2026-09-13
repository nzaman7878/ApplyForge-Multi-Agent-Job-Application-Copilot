const express = require('express');
const pipelineController = require('../controllers/pipeline.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const pipelineValidators = require('../validators/pipeline.validators');

const router = express.Router();

/**
 * @route   POST /api/pipeline/run
 * @desc    Start pipeline run with resumeId & jdId, returns state at awaiting_review
 * @access  Protected
 */
router.post(
  '/run',
  auth,
  validate(pipelineValidators.runPipeline),
  pipelineController.runPipeline
);

/**
 * @route   GET /api/pipeline/:runId
 * @desc    Get current state and status of a pipeline run
 * @access  Protected
 */
router.get(
  '/:runId',
  auth,
  validate(pipelineValidators.runIdParam),
  pipelineController.getPipelineStatus
);

/**
 * @route   POST /api/pipeline/:runId/approve
 * @desc    Resume pipeline with human approval and transition to save
 * @access  Protected
 */
router.post(
  '/:runId/approve',
  auth,
  validate(pipelineValidators.runIdParam),
  pipelineController.approvePipeline
);

/**
 * @route   POST /api/pipeline/:runId/edit
 * @desc    Resume pipeline with user edits and loop back to tailoring
 * @access  Protected
 */
router.post(
  '/:runId/edit',
  auth,
  validate(pipelineValidators.editPipeline),
  pipelineController.editPipeline
);

module.exports = router;
