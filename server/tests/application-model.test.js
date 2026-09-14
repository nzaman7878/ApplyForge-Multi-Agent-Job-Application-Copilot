const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const Application = require('../src/models/Application');

async function testApplicationModel() {
  console.log('🧪 Testing Application Model with Full CRM Fields (Phase 71)...\n');

  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // Seed test User
    const user = new User({
      name: 'Sarah Connor',
      email: 'sarah.connor@skyline.dev',
      passwordHash: 'hashedSecurePassword123!',
    });
    await user.save();

    // Seed Resume and JD for relationship testing
    const resume = new Resume({
      userId: user._id,
      originalFilename: 'sarah_resume.pdf',
      rawText: 'Staff Systems Engineer...',
    });
    await resume.save();

    const jd = new JobDescription({
      userId: user._id,
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
      rawText: 'Looking for a Systems Architect...',
    });
    await jd.save();

    // [Test 1] Validate Required Fields
    console.log('[Test 1] Validating required fields (userId, company, roleTitle)...');
    const emptyApp = new Application({});
    let validationErr = null;
    try {
      await emptyApp.validate();
    } catch (err) {
      validationErr = err;
    }
    assert.ok(validationErr, 'Application validation must fail on empty document');
    assert.ok(validationErr.errors.userId, 'userId is required');
    assert.ok(validationErr.errors.company, 'company is required');
    assert.ok(validationErr.errors.roleTitle, 'roleTitle is required');
    console.log('  ✔ Correctly rejected document missing required fields');

    // [Test 2] Status Enum Validation & Default
    console.log('[Test 2] Validating status enum values and defaults...');
    const defaultApp = new Application({
      userId: user._id,
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
    });
    assert.strictEqual(defaultApp.status, 'applied', 'Default status must be "applied"');

    const validStatuses = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected'];
    for (const validStatus of validStatuses) {
      defaultApp.status = validStatus;
      await defaultApp.validate();
    }
    console.log('  ✔ All allowed enum values validated:', validStatuses.join(', '));

    defaultApp.status = 'unknown_status';
    let enumErr = null;
    try {
      await defaultApp.validate();
    } catch (err) {
      enumErr = err;
    }
    assert.ok(enumErr && enumErr.errors.status, 'Must reject invalid status value');
    console.log('  ✔ Correctly rejected invalid status enum value');

    // [Test 3] Default CRM field values
    console.log('[Test 3] Validating default CRM field values...');
    const appWithDefaults = new Application({
      userId: user._id,
      company: 'OpenAI',
      roleTitle: 'Research Engineer',
    });
    assert.ok(appWithDefaults.appliedAt instanceof Date, 'appliedAt should default to Date');
    assert.strictEqual(appWithDefaults.lastFollowUpAt, null, 'lastFollowUpAt should default to null');
    assert.strictEqual(appWithDefaults.nextFollowUpAt, null, 'nextFollowUpAt should default to null');
    assert.strictEqual(appWithDefaults.userEdits, null, 'userEdits should default to null');
    assert.strictEqual(appWithDefaults.coverLetter, null, 'coverLetter should default to null');
    assert.strictEqual(appWithDefaults.atsReport, null, 'atsReport should default to null');
    assert.strictEqual(appWithDefaults.fitScore, null, 'fitScore should default to null');
    assert.strictEqual(appWithDefaults.jobDescription, '', 'jobDescription should default to empty string');
    assert.deepStrictEqual(appWithDefaults.tailoredResume, [], 'tailoredResume should default to empty array');
    console.log('  ✔ Default CRM fields initialized as expected');

    // [Test 4] Save Application with Full CRM Fields
    console.log('[Test 4] Saving Application with all CRM fields from specification...');
    const appliedDate = new Date('2026-09-01T10:00:00.000Z');
    const lastFollowUp = new Date('2026-09-07T14:30:00.000Z');
    const nextFollowUp = new Date('2026-09-15T09:00:00.000Z');

    const fullApp = new Application({
      userId: user._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      jobDescription: 'Design, build, and scale global payments infrastructure with 99.999% availability.',
      tailoredResume: [
        {
          originalBullet: 'Maintained servers and databases',
          tailoredBullet: 'Architected distributed systems serving 50M+ requests/day at 99.99% uptime',
          reasoning: 'Quantified impact and emphasized high availability',
        },
      ],
      coverLetter: {
        subject: 'Application for Staff Infrastructure Engineer - Sarah Connor',
        body: 'Dear Stripe Engineering Team, I have spent the last 8 years designing resilient systems...',
        keyThemes: ['Distributed Systems', 'Fault Tolerance', 'Financial Scale'],
      },
      atsReport: {
        overallScore: 94,
        matchedKeywords: [
          { keyword: 'Distributed Systems', importance: 'required', location: 'Experience' },
          { keyword: 'Go', importance: 'preferred', location: 'Skills' },
        ],
        missingKeywords: [],
      },
      fitScore: {
        score: 91,
        tier: 'strong',
        strengths: ['Deep distributed systems experience', 'Production high-availability scale'],
        gaps: [],
      },
      status: 'interviewing',
      appliedAt: appliedDate,
      lastFollowUpAt: lastFollowUp,
      nextFollowUpAt: nextFollowUp,
      userEdits: {
        revisionNotes: 'Emphasize cloud cost reduction metrics in bullet 1',
        iteration: 1,
      },
      notes: 'Passed technical screening with Engineering Director on Sept 7.',
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'pipeline-run-stripe-001',
    });

    await fullApp.save();
    assert.ok(fullApp._id, 'Saved document must have _id');
    console.log('  ✔ Application document saved successfully (ID:', fullApp._id, ')');

    // [Test 5] Querying and Pre-save Synchronization
    console.log('[Test 5] Verifying saved document and pre-save field sync...');
    const fetchedApp = await Application.findById(fullApp._id)
      .populate('userId', 'name email')
      .populate('resumeId', 'originalFilename')
      .populate('jdId', 'company roleTitle');

    assert.strictEqual(fetchedApp.company, 'Stripe');
    assert.strictEqual(fetchedApp.roleTitle, 'Staff Infrastructure Engineer');
    assert.strictEqual(fetchedApp.status, 'interviewing');
    assert.strictEqual(fetchedApp.appliedAt.toISOString(), appliedDate.toISOString());
    assert.strictEqual(fetchedApp.lastFollowUpAt.toISOString(), lastFollowUp.toISOString());
    assert.strictEqual(fetchedApp.nextFollowUpAt.toISOString(), nextFollowUp.toISOString());
    assert.strictEqual(fetchedApp.userEdits.iteration, 1);
    assert.strictEqual(fetchedApp.atsReport.overallScore, 94);
    assert.strictEqual(fetchedApp.fitScore.tier, 'strong');
    assert.strictEqual(fetchedApp.tailoredResume.length, 1);
    assert.strictEqual(fetchedApp.tailoredBullets.length, 1, 'tailoredBullets should sync with tailoredResume');
    assert.strictEqual(fetchedApp.userId.email, 'sarah.connor@skyline.dev');
    assert.strictEqual(fetchedApp.resumeId.originalFilename, 'sarah_resume.pdf');
    assert.strictEqual(fetchedApp.jdId.company, 'Anthropic');
    console.log('  ✔ CRM fields and Mongoose relationships verified');

    // [Test 6] JSON Serialization (toJSON method)
    console.log('[Test 6] Validating toJSON serialization...');
    const serialized = fullApp.toJSON();
    assert.strictEqual(serialized.id.toString(), fullApp._id.toString(), 'toJSON exposes .id string');
    assert.strictEqual(serialized.__v, undefined, 'toJSON strips __v version key');
    assert.strictEqual(serialized.company, 'Stripe');
    console.log('  ✔ toJSON method correctly formats API response');

    // [Test 7] CRM Queries (Status filtering & Follow-up reminders)
    console.log('[Test 7] Verifying CRM queries by status and upcoming follow-ups...');
    const activeInterviewing = await Application.find({
      userId: user._id,
      status: 'interviewing',
    });
    assert.strictEqual(activeInterviewing.length, 1);

    const upcomingFollowUps = await Application.find({
      userId: user._id,
      nextFollowUpAt: { $gte: new Date('2026-09-10T00:00:00.000Z') },
    });
    assert.strictEqual(upcomingFollowUps.length, 1);
    console.log('  ✔ CRM indexed queries by status and nextFollowUpAt operate as expected');

    console.log('\n🎉 ALL APPLICATION MODEL CRM TESTS PASSED!\n');
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
  testApplicationModel().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testApplicationModel };
