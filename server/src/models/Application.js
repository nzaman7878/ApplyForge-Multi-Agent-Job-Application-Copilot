const mongoose = require('mongoose');

/**
 * Application Schema
 * Comprehensive Job Application CRM model tracking applications through their entire lifecycle:
 * - Candidate & Target Role Identification (userId, company, roleTitle, jobDescription)
 * - Multi-Agent Tailored Application Artifacts (tailoredResume, coverLetter, atsReport, fitScore)
 * - Application Status & Lifecycle Pipeline (status enum: wishlist, applied, interviewing, offer, rejected)
 * - CRM Follow-Up Tracking (appliedAt, lastFollowUpAt, nextFollowUpAt)
 * - Human-in-the-Loop Feedback & Edits (userEdits, notes)
 * - Relational References (resumeId, jdId, pipelineRunId, runId)
 */
const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    roleTitle: {
      type: String,
      required: [true, 'Role title is required'],
      trim: true,
    },
    // Raw text or structured requirements of the job description
    jobDescription: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
    },
    // Tailored resume representation (bullets array, sections, or markdown)
    tailoredResume: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [],
    },
    // Tailored bullets alias / sub-array for backward compatibility
    tailoredBullets: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Tailored cover letter (subject, body, keyThemes)
    coverLetter: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // ATS Keyword & match analysis report
    atsReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Overall fit score & qualitative gap analysis
    fitScore: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // CRM Application Status Enum
    status: {
      type: String,
      enum: {
        values: ['wishlist', 'applied', 'interviewing', 'offer', 'rejected'],
        message: '{VALUE} is not a valid application status',
      },
      default: 'applied',
      index: true,
    },
    // Follow-up & Lifecycle Timestamps
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    lastFollowUpAt: {
      type: Date,
      default: null,
    },
    nextFollowUpAt: {
      type: Date,
      default: null,
      index: true,
    },
    // User feedback / prompt directives from human review
    userEdits: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Candidate personal notes
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    // Relational references to source documents and pipeline runs
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      default: null,
      index: true,
    },
    jdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
      default: null,
      index: true,
    },
    pipelineRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PipelineRun',
      default: null,
      index: true,
    },
    runId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook
applicationSchema.pre('save', function () {
  // Synchronize appliedAt and appliedDate
  if (this.appliedAt && !this.appliedDate) {
    this.appliedDate = this.appliedAt;
  } else if (this.appliedDate && !this.appliedAt) {
    this.appliedAt = this.appliedDate;
  }

  // Synchronize tailoredResume and tailoredBullets if one is array and other empty
  if (
    Array.isArray(this.tailoredResume) &&
    this.tailoredResume.length > 0 &&
    (!this.tailoredBullets || this.tailoredBullets.length === 0)
  ) {
    this.tailoredBullets = this.tailoredResume;
  } else if (
    Array.isArray(this.tailoredBullets) &&
    this.tailoredBullets.length > 0 &&
    (!this.tailoredResume || (Array.isArray(this.tailoredResume) && this.tailoredResume.length === 0))
  ) {
    this.tailoredResume = this.tailoredBullets;
  }
});

// Compound indexes for user query performance & CRM filtering
applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ userId: 1, nextFollowUpAt: 1 });

// Transform JSON output: expose 'id' string, remove '__v'
applicationSchema.methods.toJSON = function () {
  const app = this.toObject();
  app.id = app._id;
  delete app.__v;
  return app;
};

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
