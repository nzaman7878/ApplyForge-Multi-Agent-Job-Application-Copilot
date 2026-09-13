const mongoose = require('mongoose');

/**
 * PipelineRun Schema
 * Persists intermediate & final state, status, and telemetry of LangGraph multi-agent copilot runs.
 */
const pipelineRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: [true, 'Resume ID is required'],
      index: true,
    },
    jdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: [true, 'Job Description ID is required'],
      index: true,
    },
    runId: {
      type: String,
      required: [true, 'Run ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          'idle',
          'parsing',
          'tailoring',
          'scoring',
          'awaiting_review',
          'review_approved',
          'saved',
          'completed',
          'failed',
        ],
        message: '{VALUE} is not a valid pipeline status',
      },
      default: 'awaiting_review',
      index: true,
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for listing user's runs in reverse chronological order
pipelineRunSchema.index({ userId: 1, createdAt: -1 });

// Transform JSON output
pipelineRunSchema.methods.toJSON = function () {
  const run = this.toObject();
  run.id = run._id;
  delete run.__v;
  return run;
};

const PipelineRun = mongoose.model('PipelineRun', pipelineRunSchema);

module.exports = PipelineRun;
