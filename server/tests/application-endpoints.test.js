const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5007';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const Application = require('../src/models/Application');
const PipelineRun = require('../src/models/PipelineRun');
const { signToken } = require('../src/utils/jwt');

async function testApplicationEndpoints() {
  console.log('🧪 Testing Application CRUD Endpoints (Phase 72)...\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // Create test users
    const userA = new User({
      name: 'Sarah Connor',
      email: 'sarah@skyline.dev',
      passwordHash: 'Hash123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'John Connor',
      email: 'john@skyline.dev',
      passwordHash: 'Hash123!',
    });
    await userB.save();
    const tokenB = signToken(userB._id);

    // Seed test JD & Resume
    const resume = await Resume.create({
      userId: userA._id,
      originalFilename: 'resume.pdf',
      storedFilename: 'resume-123.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileHash: 'abcdef1234567890',
      rawText: 'Software Engineer with Node.js and React experience.',
    });

    const jd = await JobDescription.create({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      rawText: 'Looking for distributed systems experts.',
    });

    const pipelineRun = await PipelineRun.create({
      userId: userA._id,
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'run-uuid-pipeline-123',
      status: 'awaiting_review',
      state: {
        tailoredBullets: [{ tailoredBullet: 'Optimized high-throughput payment gateways' }],
        atsReport: { overallScore: 92 },
        coverLetter: { subject: 'Staff Engineer Application' },
        fitScore: { score: 95, tier: 'strong' },
      },
    });

    // [Test 1] 401 unauthenticated
    console.log('[Test 1] GET /api/applications without token (expect 401)...');
    await request(app)
      .get('/api/applications')
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated request');

    // [Test 2] POST /api/applications create with validation
    console.log('[Test 2] POST /api/applications create application...');
    const emptyCreate = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    assert.strictEqual(emptyCreate.status, 400);
    assert.ok(emptyCreate.body.details.some((d) => d.field === 'company'));
    assert.ok(emptyCreate.body.details.some((d) => d.field === 'roleTitle'));
    console.log('  ✔ Validation correctly enforced on POST /api/applications');

    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        company: 'Stripe',
        roleTitle: 'Staff Infrastructure Engineer',
        status: 'applied',
        jobDescription: 'Looking for distributed systems experts.',
        tailoredResume: [{ tailoredBullet: 'Optimized high-throughput payment gateways' }],
        coverLetter: { subject: 'Staff Engineer Application', body: 'Dear Hiring Team...' },
        atsReport: { overallScore: 92 },
        fitScore: { score: 95, tier: 'strong' },
        resumeId: resume._id,
        jdId: jd._id,
        pipelineRunId: pipelineRun._id,
        runId: pipelineRun.runId,
        nextFollowUpAt: new Date('2026-09-20T10:00:00.000Z'),
      });

    assert.strictEqual(createRes.status, 201);
    const createdApp = createRes.body.application;
    assert.strictEqual(createdApp.company, 'Stripe');
    assert.strictEqual(createdApp.roleTitle, 'Staff Infrastructure Engineer');
    assert.strictEqual(createdApp.status, 'applied');
    assert.strictEqual(createdApp.pipelineRunId.toString(), pipelineRun._id.toString());
    console.log('  ✔ Created application successfully (ID:', createdApp.id, ')');

    // Seed additional applications for pagination and status filtering
    const appWishlist = await Application.create({
      userId: userA._id,
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
      status: 'wishlist',
      jobDescription: 'AI safety systems',
    });

    const appInterview = await Application.create({
      userId: userA._id,
      company: 'OpenAI',
      roleTitle: 'Kernel Engineer',
      status: 'interviewing',
      jobDescription: 'GPU kernel engineering',
    });

    const appOffer = await Application.create({
      userId: userA._id,
      company: 'Google',
      roleTitle: 'Principal Engineer',
      status: 'offer',
      jobDescription: 'Cloud infrastructure',
    });

    // [Test 3] GET /api/applications list with pagination
    console.log('[Test 3] GET /api/applications pagination (page 1, limit 2)...');
    const page1Res = await request(app)
      .get('/api/applications?page=1&limit=2')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(page1Res.body.count, 2);
    assert.strictEqual(page1Res.body.total, 4);
    assert.strictEqual(page1Res.body.page, 1);
    assert.strictEqual(page1Res.body.totalPages, 2);
    assert.strictEqual(page1Res.body.limit, 2);
    console.log('  ✔ Page 1 retrieved 2 items out of 4 total');

    const page2Res = await request(app)
      .get('/api/applications?page=2&limit=2')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(page2Res.body.count, 2);
    assert.strictEqual(page2Res.body.page, 2);
    console.log('  ✔ Page 2 pagination verified');

    // [Test 4] GET /api/applications filter by status
    console.log('[Test 4] GET /api/applications filter by status=interviewing...');
    const filterRes = await request(app)
      .get('/api/applications?status=interviewing')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(filterRes.body.total, 1);
    assert.strictEqual(filterRes.body.applications[0].company, 'OpenAI');
    assert.strictEqual(filterRes.body.applications[0].status, 'interviewing');
    console.log('  ✔ Status filtering correctly returned only "interviewing" application');

    // [Test 5] User isolation check
    console.log('[Test 5] User B accesses /api/applications (expect total 0)...');
    const userBList = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    assert.strictEqual(userBList.body.total, 0);
    assert.strictEqual(userBList.body.count, 0);
    console.log('  ✔ Tenant isolation verified for User B');

    // [Test 6] GET /api/applications/:id full detail by ObjectId
    console.log('[Test 6] GET /api/applications/:id by ObjectId...');
    const detailRes = await request(app)
      .get(`/api/applications/${createdApp.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(detailRes.body.application.company, 'Stripe');
    assert.strictEqual(detailRes.body.application.roleTitle, 'Staff Infrastructure Engineer');
    assert.strictEqual(detailRes.body.application.fitScore.score, 95);
    assert.strictEqual(detailRes.body.application.atsReport.overallScore, 92);
    assert.strictEqual(detailRes.body.application.tailoredResume.length, 1);
    console.log('  ✔ Retrieved full application detail with all CRM fields');

    // [Test 7] GET /api/applications/:id fallback by runId
    console.log('[Test 7] GET /api/applications/:id fallback by runId...');
    const runIdDetail = await request(app)
      .get(`/api/applications/${pipelineRun.runId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(runIdDetail.body.application.company, 'Stripe');
    console.log('  ✔ Successfully retrieved application detail using runId');

    // [Test 8] Unauthorized access check (403)
    console.log('[Test 8] User B attempts to access User A application (expect 403)...');
    await request(app)
      .get(`/api/applications/${createdApp.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    console.log('  ✔ Forbidden (403) correctly returned for cross-user access');

    // [Test 9] PATCH /api/applications/:id update status and follow-up dates
    console.log('[Test 9] PATCH /api/applications/:id update status & follow-up dates...');
    const followUpDate = new Date('2026-09-25T15:00:00.000Z');
    const patchRes = await request(app)
      .patch(`/api/applications/${createdApp.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'interviewing',
        lastFollowUpAt: new Date('2026-09-15T12:00:00.000Z'),
        nextFollowUpAt: followUpDate,
        notes: 'Recruiter phone screen passed; panel scheduled for next week.',
      })
      .expect(200);

    assert.strictEqual(patchRes.body.application.status, 'interviewing');
    assert.strictEqual(
      new Date(patchRes.body.application.nextFollowUpAt).toISOString(),
      followUpDate.toISOString()
    );
    assert.strictEqual(
      patchRes.body.application.notes,
      'Recruiter phone screen passed; panel scheduled for next week.'
    );
    console.log('  ✔ PATCH /api/applications/:id updated status, dates, and notes');

    // [Test 10] PATCH /api/applications/:id with invalid status (expect 400)
    console.log('[Test 10] PATCH with invalid status (expect 400)...');
    const invalidPatch = await request(app)
      .patch(`/api/applications/${createdApp.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'invalid_status_xyz' });
    assert.strictEqual(invalidPatch.status, 400);
    console.log('  ✔ Correctly rejected invalid status in PATCH');

    // [Test 11] PUT /api/applications/:id backward compatibility
    console.log('[Test 11] PUT /api/applications/:id backward compatibility...');
    const putRes = await request(app)
      .put(`/api/applications/${createdApp.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ notes: 'Updated notes via PUT' })
      .expect(200);

    assert.strictEqual(putRes.body.application.notes, 'Updated notes via PUT');
    console.log('  ✔ PUT /api/applications/:id functions as expected');

    // [Test 12] DELETE /api/applications/:id
    console.log('[Test 12] DELETE /api/applications/:id...');
    // Unauthorized delete attempt
    await request(app)
      .delete(`/api/applications/${appWishlist._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    console.log('  ✔ User B prevented from deleting User A application (403)');

    // Authorized delete
    const deleteRes = await request(app)
      .delete(`/api/applications/${appWishlist._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(deleteRes.body.id.toString(), appWishlist._id.toString());
    console.log('  ✔ Application deleted successfully');

    // Confirm it's gone
    await request(app)
      .get(`/api/applications/${appWishlist._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    console.log('  ✔ Verified deleted application returns 404');

    console.log('\n🎉 ALL APPLICATION CRUD ENDPOINT TESTS PASSED SUCCESSFULLY!\n');
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
  testApplicationEndpoints().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testApplicationEndpoints };
