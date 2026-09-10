const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' },
    github: { type: String, trim: true, default: '' },
    portfolio: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    startDate: { type: String, trim: true, default: '' },
    endDate: { type: String, trim: true, default: '' },
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, default: '' },
    bulletPoints: [{ type: String, trim: true }],
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true, default: '' },
    degree: { type: String, trim: true, default: '' },
    fieldOfStudy: { type: String, trim: true, default: '' },
    startDate: { type: String, trim: true, default: '' },
    endDate: { type: String, trim: true, default: '' },
    gpa: { type: String, trim: true, default: '' },
    honors: [{ type: String, trim: true }],
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    issuer: { type: String, trim: true, default: '' },
    date: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const parsedSectionsSchema = new mongoose.Schema(
  {
    contact: {
      type: contactSchema,
      default: () => ({}),
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    experience: {
      type: [experienceSchema],
      default: [],
    },
    education: {
      type: [educationSchema],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [certificationSchema],
      default: [],
    },
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    rawText: {
      type: String,
      required: [true, 'Raw resume text is required'],
    },
    parsedSections: {
      type: parsedSectionsSchema,
      default: () => ({}),
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    filePath: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    mimeType: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user query performance
resumeSchema.index({ userId: 1, uploadedAt: -1 });

// Transform JSON output
resumeSchema.methods.toJSON = function () {
  const resume = this.toObject();
  resume.id = resume._id;
  delete resume.__v;
  return resume;
};

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
