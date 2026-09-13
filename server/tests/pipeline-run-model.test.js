const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const PipelineRun = require('../src/models/PipelineRun');
const Application = require('../src/models/Application');

async function testPipelineRunModel() {
  console.log('🧪 Testing PipelineRun & Application Models (Phase 60)...\n');

  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 1. Create dependencies
    const user = new User({
      name: 'Test Candidate',
      email: 'candidate@example.com',
      passwordHash: 'secretHash123',
    });
    await user.save();

    const resume = new Resume({
      userId: user._id,
      originalFilename: 'resume.pdf',
      rawText: 'Candidate content',
      parsedSections: {
        skills: ['Node.js', 'React'],
      },
    });
    await resume.save();

    const jd = new JobDescription({
      userId: user._id,
      company: 'TechCorp',
      roleTitle: 'Full-Stack Developer',
      rawText: 'Need Node.js and React',
      parsedRequirements: {
        skills: ['Node.js', 'React'],
      },
    });
    await jd.save();

    // [Test 1] Validate PipelineRun required fields
    console.log('[Test 1] Validating PipelineRun required fields...');
    const emptyRun = new PipelineRun({});
    let validationErr = null;
    try {
      await emptyRun.validate();
    } catch (err) {
      validationErr = err;
    }
    assert.ok(validationErr, 'Validation must fail on empty document');
    assert.ok(validationErr.errors.userId, 'userId is required');
    assert.ok(validationErr.errors.resumeId, 'resumeId is required');
    assert.ok(validationErr.errors.jdId, 'jdId is required');
    assert.ok(validationErr.errors.runId, 'runId is required');
    console.log('  ✔ PipelineRun correctly enforces required fields');

    // [Test 2] Validate PipelineRun status enum and defaults
    console.log('[Test 2] Validating PipelineRun status enum and defaults...');
    const defaultRun = new PipelineRun({
      userId: user._id,
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'run-uuid-1',
    });
    assert.strictEqual(defaultRun.status, 'awaiting_review', 'Default status must be awaiting_review');

    defaultRun.status = 'invalid-status-xyz';
    let enumErr = null;
    try {
      await defaultRun.validate();
    } catch (err) {
      enumErr = err;
    }
    assert.ok(enumErr && enumErr.errors.status, 'Must reject invalid status enum');
    console.log('  ✔ PipelineRun status enum validated');

    // [Test 3] Create and save valid PipelineRun
    console.log('[Test 3] Creating and saving full PipelineRun document...');
    const validRun = new PipelineRun({
      userId: user._id,
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'run-uuid-1234-test',
      status: 'awaiting_review',
      state: {
        tailoredBullets: [{ tailoredBullet: 'Architected Node.js APIs' }],
        atsReport: { overallScore: 88 },
        coverLetter: { subject: 'Application' },
        fitScore: { score: 90, tier: 'strong' },
      },
    });
    await validRun.save();
    assert.ok(validRun._id);

    const jsonRun = validRun.toJSON();
    assert.strictEqual(jsonRun.id.toString(), validRun._id.toString());
    assert.strictEqual(jsonRun.__v, undefined);
    console.log('  ✔ PipelineRun saved and serialized cleanly with ID:', validRun._id);

    // [Test 4] Create Application model referencing PipelineRun
    console.log('[Test 4] Validating Application model with pipelineRunId and runId...');
    const application = new Application({
      userId: user._id,
      company: 'TechCorp',
      roleTitle: 'Full-Stack Developer',
      status: 'applied',
      resumeId: resume._id,
      jdId: jd._id,
      pipelineRunId: validRun._id,
      runId: validRun.runId,
      tailoredBullets: validRun.state.tailoredBullets,
      coverLetter: validRun.state.coverLetter,
      fitScore: validRun.state.fitScore,
    });
    await application.save();

    assert.ok(application._id);
    assert.strictEqual(application.pipelineRunId.toString(), validRun._id.toString());
    assert.strictEqual(application.runId, validRun.runId);

    const jsonApp = application.toJSON();
    assert.strictEqual(jsonApp.id.toString(), application._id.toString());
    assert.strictEqual(jsonApp.__v, undefined);
    console.log('  ✔ Application document successfully saved with PipelineRun reference');

    // [Test 5] Query relations with populate
    console.log('[Test 5] Querying Application populated with PipelineRun...');
    const queriedApp = await Application.findById(application._id)
      .populate('pipelineRunId')
      .populate('userId')
      .populate('resumeId')
      .populate('jdId');

    assert.strictEqual(queriedApp.pipelineRunId.runId, 'run-uuid-1234-test');
    assert.strictEqual(queriedApp.userId.email, 'candidate@example.com');
    assert.strictEqual(queriedApp.resumeId.originalFilename, 'resume.pdf');
    assert.strictEqual(queriedApp.jdId.company, 'TechCorp');
    console.log('  ✔ Mongoose population verified across Application -> PipelineRun, User, Resume, JD');

    console.log('\n🎉 ALL PIPELINE RUN & APPLICATION MODEL TESTS PASSED!\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

if (require.main === module) {
  testPipelineRunModel().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testPipelineRunModel };
