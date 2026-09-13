const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5006';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const { signToken } = require('../src/utils/jwt');
const { resetRunsStore } = require('../src/controllers/pipeline.controller');

async function testPipelineEndpoints() {
  console.log('🧪 Testing Pipeline API Endpoints (Phase 59)...\n');

  let mongoServer;

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    resetRunsStore();

    // 2. Seed Users
    const userA = new User({
      name: 'Alice Engineer',
      email: 'alice@example.com',
      passwordHash: 'Hash123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'Bob Hacker',
      email: 'bob@example.com',
      passwordHash: 'Hash123!',
    });
    await userB.save();
    const tokenB = signToken(userB._id);

    console.log(`✔ Seeded user A (${userA._id}) and user B (${userB._id})`);

    // 3. Seed Resumes and Job Descriptions
    const resumeA = new Resume({
      userId: userA._id,
      originalFilename: 'alice_resume.pdf',
      rawText: 'Alice Engineer\nSenior Backend\nSkills: Node.js, PostgreSQL, Docker',
      parsedSections: {
        contact: { name: 'Alice Engineer', email: 'alice@example.com' },
        summary: 'Senior distributed systems developer',
        skills: ['Node.js', 'PostgreSQL', 'Docker'],
        experience: [
          {
            company: 'CloudTech',
            title: 'Senior Backend Engineer',
            bulletPoints: ['Engineered scalable microservices handling 40k RPS with Node.js and PostgreSQL.'],
          },
        ],
      },
    });
    await resumeA.save();

    const jdA = new JobDescription({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Staff Backend Engineer',
      rawText: 'Seeking Staff Engineer with Node.js, PostgreSQL, Redis',
      parsedRequirements: {
        skills: ['Node.js', 'PostgreSQL', 'Redis'],
        experience: ['5+ years'],
        qualifications: ["Bachelor's in CS or equivalent"],
        niceToHave: ['Kafka'],
      },
    });
    await jdA.save();

    const resumeB = new Resume({
      userId: userB._id,
      originalFilename: 'bob_resume.docx',
      rawText: 'Bob Hacker\nSecurity Engineer',
      parsedSections: {
        contact: { name: 'Bob Hacker', email: 'bob@example.com' },
        skills: ['Python', 'Linux'],
      },
    });
    await resumeB.save();

    console.log('✔ Seeded test resumes and job descriptions');

    // =========================================================================
    // PART 1: POST /api/pipeline/run
    // =========================================================================
    console.log('\n--- PART 1: POST /api/pipeline/run ---');

    // [Test 1] 401 on missing auth token
    console.log('[Test 1] POST /api/pipeline/run without token (expect 401)...');
    const noAuthRunRes = await request(app)
      .post('/api/pipeline/run')
      .send({ resumeId: resumeA._id, jdId: jdA._id })
      .expect(401);
    assert.strictEqual(noAuthRunRes.body.code, 'TOKEN_MISSING');
    console.log('  ✔ Correctly rejected unauthenticated run request (401 TOKEN_MISSING)');

    // [Test 2] 400 on missing parameters
    console.log('[Test 2] POST /api/pipeline/run with missing fields (expect 400)...');
    const missingParamsRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(400);
    assert.strictEqual(missingParamsRes.body.error, 'Validation failed');
    console.log('  ✔ Correctly rejected missing resumeId and jdId (400)');

    // [Test 3] 400 on invalid ObjectId
    console.log('[Test 3] POST /api/pipeline/run with invalid ObjectId (expect 400)...');
    const invalidIdRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resumeId: 'invalid-id-format', jdId: '123' })
      .expect(400);
    assert.strictEqual(invalidIdRes.body.error, 'Validation failed');
    console.log('  ✔ Correctly rejected non-ObjectId strings (400)');

    // [Test 4] 404 on non-existent resume or JD
    console.log('[Test 4] POST /api/pipeline/run with non-existent document ID (expect 404)...');
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resumeId: fakeId, jdId: jdA._id })
      .expect(404);
    assert.strictEqual(notFoundRes.body.error, 'Resume not found');
    console.log('  ✔ Correctly handled 404 for missing resume');

    // [Test 5] 403 on cross-user document access
    console.log('[Test 5] POST /api/pipeline/run accessing another user\'s document (expect 403)...');
    const forbiddenRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resumeId: resumeB._id, jdId: jdA._id })
      .expect(403);
    assert.strictEqual(forbiddenRes.body.error, 'Forbidden');
    console.log('  ✔ Correctly prevented User A from utilizing User B\'s resume (403)');

    // [Test 6] 201 Success starting pipeline
    console.log('[Test 6] POST /api/pipeline/run valid request (expect 201)...');
    const validRunRes = await request(app)
      .post('/api/pipeline/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resumeId: resumeA._id, jdId: jdA._id })
      .expect(201);

    assert.ok(validRunRes.body.runId, 'Must return runId');
    assert.strictEqual(validRunRes.body.status, 'awaiting_review', 'Status must be awaiting_review');
    assert.ok(validRunRes.body.state, 'Must return state object');

    const runState = validRunRes.body.state;
    assert.ok(runState.structuredResume, 'State must contain structuredResume');
    assert.ok(runState.structuredJD, 'State must contain structuredJD');
    assert.ok(Array.isArray(runState.tailoredBullets) && runState.tailoredBullets.length > 0, 'Must have tailoredBullets');
    assert.ok(runState.atsReport && typeof runState.atsReport.overallScore === 'number', 'Must have atsReport');
    assert.ok(runState.coverLetter && runState.coverLetter.subject, 'Must have coverLetter');
    assert.ok(runState.fitScore && typeof runState.fitScore.score === 'number', 'Must have fitScore');

    const createdRunId = validRunRes.body.runId;
    console.log('  ✔ Pipeline run started successfully:\n', {
      runId: createdRunId,
      status: validRunRes.body.status,
      tailoredBulletsCount: runState.tailoredBullets.length,
      atsScore: runState.atsReport.overallScore,
      fitScore: runState.fitScore.score,
      tier: runState.fitScore.tier,
    });

    // =========================================================================
    // PART 2: GET /api/pipeline/:runId
    // =========================================================================
    console.log('\n--- PART 2: GET /api/pipeline/:runId ---');

    // [Test 7] 401 unauthenticated
    console.log('[Test 7] GET /api/pipeline/:runId without token (expect 401)...');
    await request(app)
      .get(`/api/pipeline/${createdRunId}`)
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated status request (401)');

    // [Test 8] 404 for unknown runId
    console.log('[Test 8] GET /api/pipeline/:runId with non-existent runId (expect 404)...');
    const unknownRunRes = await request(app)
      .get('/api/pipeline/non-existent-run-id-123')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    assert.strictEqual(unknownRunRes.body.error, 'Pipeline run not found');
    console.log('  ✔ Correctly returned 404 for unknown runId');

    // [Test 9] 403 on another user's runId
    console.log('[Test 9] GET /api/pipeline/:runId by unauthorized User B (expect 403)...');
    const userBAccessRes = await request(app)
      .get(`/api/pipeline/${createdRunId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    assert.strictEqual(userBAccessRes.body.error, 'Forbidden');
    console.log('  ✔ User B isolated from User A\'s pipeline run (403)');

    // [Test 10] 200 OK retrieving run status
    console.log('[Test 10] GET /api/pipeline/:runId authorized User A (expect 200)...');
    const getStatusRes = await request(app)
      .get(`/api/pipeline/${createdRunId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(getStatusRes.body.runId, createdRunId);
    assert.strictEqual(getStatusRes.body.status, 'awaiting_review');
    assert.strictEqual(getStatusRes.body.state.fitScore.tier, runState.fitScore.tier);
    console.log('  ✔ Current run state and status retrieved successfully');

    // =========================================================================
    // PART 3: POST /api/pipeline/:runId/edit
    // =========================================================================
    console.log('\n--- PART 3: POST /api/pipeline/:runId/edit ---');

    // [Test 11] 401 unauthenticated
    console.log('[Test 11] POST /api/pipeline/:runId/edit without token (expect 401)...');
    await request(app)
      .post(`/api/pipeline/${createdRunId}/edit`)
      .send({ notes: 'Add Redis expertise' })
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated edit request (401)');

    // [Test 12] 403 unauthorized user
    console.log('[Test 12] POST /api/pipeline/:runId/edit by User B (expect 403)...');
    await request(app)
      .post(`/api/pipeline/${createdRunId}/edit`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ notes: 'Unauthorized edit' })
      .expect(403);
    console.log('  ✔ User B isolated from editing User A\'s run (403)');

    // [Test 13] 200 OK edit and loop back
    console.log('[Test 13] POST /api/pipeline/:runId/edit with user edits (expect 200)...');
    const editRes = await request(app)
      .post(`/api/pipeline/${createdRunId}/edit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        userEdits: {
          notes: 'Emphasize high availability distributed caching and 99.99% uptime.',
        },
      })
      .expect(200);

    assert.strictEqual(editRes.body.runId, createdRunId);
    assert.strictEqual(editRes.body.status, 'awaiting_review');
    assert.ok(Array.isArray(editRes.body.state.tailoredBullets));
    assert.strictEqual(editRes.body.state.humanApproved, false);
    console.log('  ✔ Pipeline looped back with user edits and re-paused at awaiting_review');

    // =========================================================================
    // PART 4: POST /api/pipeline/:runId/approve
    // =========================================================================
    console.log('\n--- PART 4: POST /api/pipeline/:runId/approve ---');

    // [Test 14] 401 unauthenticated
    console.log('[Test 14] POST /api/pipeline/:runId/approve without token (expect 401)...');
    await request(app)
      .post(`/api/pipeline/${createdRunId}/approve`)
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated approve request (401)');

    // [Test 15] 403 unauthorized user
    console.log('[Test 15] POST /api/pipeline/:runId/approve by User B (expect 403)...');
    await request(app)
      .post(`/api/pipeline/${createdRunId}/approve`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    console.log('  ✔ User B isolated from approving User A\'s run (403)');

    // [Test 16] 200 OK approve and save
    console.log('[Test 16] POST /api/pipeline/:runId/approve by User A (expect 200)...');
    const approveRes = await request(app)
      .post(`/api/pipeline/${createdRunId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(approveRes.body.runId, createdRunId);
    assert.strictEqual(approveRes.body.status, 'saved');
    assert.strictEqual(approveRes.body.state.humanApproved, true);
    console.log('  ✔ Pipeline approved and transitioned to "saved" status');

    // [Test 17] Subsequent GET verifies saved status
    console.log('[Test 17] GET /api/pipeline/:runId after approval (expect status: "saved")...');
    const finalGetRes = await request(app)
      .get(`/api/pipeline/${createdRunId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(finalGetRes.body.status, 'saved');
    assert.strictEqual(finalGetRes.body.state.humanApproved, true);
    console.log('  ✔ Persistent status after approval confirmed as "saved"');

    console.log('\n🎉 ALL PIPELINE API ENDPOINT TESTS PASSED SUCCESSFULLY!\n');
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
  testPipelineEndpoints().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testPipelineEndpoints };
