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
const { signToken } = require('../src/utils/jwt');

async function testApplicationEndpoints() {
  console.log('🧪 Testing Application API Endpoints...\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // Create test users
    const userA = new User({
      name: 'User A',
      email: 'usera@example.com',
      passwordHash: 'Hash123!',
    });
    await userA.save();
    const tokenA = signToken(userA._id);

    const userB = new User({
      name: 'User B',
      email: 'userb@example.com',
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
      company: 'TechCorp',
      roleTitle: 'Senior Full Stack Engineer',
      rawText: 'Looking for Node.js and React developers.',
    });

    const appDoc = await Application.create({
      userId: userA._id,
      company: 'TechCorp',
      roleTitle: 'Senior Full Stack Engineer',
      status: 'applied',
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'run-test-12345',
      tailoredBullets: [{ tailoredBullet: 'Architected scalable services with Node.js' }],
      coverLetter: { subject: 'Application for Senior Full Stack Engineer', body: 'Dear Hiring Manager...' },
      fitScore: { score: 92, tier: 'strong' },
    });

    // [Test 1] 401 unauthenticated
    console.log('[Test 1] GET /api/applications without token (expect 401)...');
    await request(app)
      .get('/api/applications')
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated request');

    // [Test 2] GET /api/applications for user A
    console.log('[Test 2] GET /api/applications for User A (expect count: 1)...');
    const listRes = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(listRes.body.count, 1);
    assert.strictEqual(listRes.body.applications[0].company, 'TechCorp');
    console.log('  ✔ User A retrieved their applications list');

    // [Test 3] GET /api/applications for user B (empty)
    console.log('[Test 3] GET /api/applications for User B (expect count: 0)...');
    const userBRes = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    assert.strictEqual(userBRes.body.count, 0);
    console.log('  ✔ User B isolated from User A\'s applications');

    // [Test 4] GET /api/applications/:id by MongoDB ObjectId
    console.log('[Test 4] GET /api/applications/:id by ObjectId...');
    const detailRes = await request(app)
      .get(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(detailRes.body.application.company, 'TechCorp');
    assert.strictEqual(detailRes.body.application.fitScore.score, 92);
    console.log('  ✔ Retrieved application details by ObjectId');

    // [Test 5] GET /api/applications/:id by runId string
    console.log('[Test 5] GET /api/applications/:id by runId string...');
    const runIdRes = await request(app)
      .get(`/api/applications/run-test-12345`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(runIdRes.body.application.runId, 'run-test-12345');
    console.log('  ✔ Retrieved application details by runId fallback');

    // [Test 6] GET /api/applications/:id by unauthorized User B (403)
    console.log('[Test 6] GET /api/applications/:id by User B (expect 403)...');
    await request(app)
      .get(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    console.log('  ✔ User B prohibited from accessing User A\'s application');

    // [Test 7] PUT /api/applications/:id update status & notes
    console.log('[Test 7] PUT /api/applications/:id update status & notes...');
    const updateRes = await request(app)
      .put(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'interviewing', notes: 'First round phone screen scheduled' })
      .expect(200);

    assert.strictEqual(updateRes.body.application.status, 'interviewing');
    assert.strictEqual(updateRes.body.application.notes, 'First round phone screen scheduled');
    console.log('  ✔ Application updated successfully');

    console.log('\n🎉 ALL APPLICATION ENDPOINT TESTS PASSED SUCCESSFULLY!\n');
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
