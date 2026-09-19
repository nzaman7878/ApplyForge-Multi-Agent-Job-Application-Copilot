const mongoose = require('mongoose');

const parsedRequirementsSchema = new mongoose.Schema(
  {
    skills: {
      type: [String],
      default: [],
    },
    experience: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: [String],
      default: [],
    },
    niceToHave: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const jobDescriptionSchema = new mongoose.Schema(
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
    rawText: {
      type: String,
      required: [true, 'Raw job description text is required'],
    },
    parsedRequirements: {
      type: parsedRequirementsSchema,
      default: () => ({}),
    },
    source: {
      type: String,
      enum: {
        values: ['paste', 'url'],
        message: '{VALUE} is not a supported JD source (must be "paste" or "url")',
      },
      default: 'paste',
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user query performance (listing JDs in reverse chronological order)
jobDescriptionSchema.index({ userId: 1, createdAt: -1 });

// Transform JSON output
jobDescriptionSchema.methods.toJSON = function () {
  const jd = this.toObject();
  jd.id = jd._id;
  delete jd.__v;
  return jd;
};

const JobDescription = mongoose.model('JobDescription', jobDescriptionSchema);

module.exports = JobDescription;
