const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5009';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const JobDescription = require('../src/models/JobDescription');
const Application = require('../src/models/Application');
const { signToken } = require('../src/utils/jwt');

async function testFollowUpDueEndpoint() {
  console.log('🧪 Testing Follow-Up Reminder Endpoint GET /api/applications/follow-ups/due (Phase 74)...\n');

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
      rawText: 'Experienced Engineer...',
    });

    const jdStripe = await JobDescription.create({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      rawText: 'Payments infrastructure...',
    });

    const jdAnthropic = await JobDescription.create({
      userId: userA._id,
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
      rawText: 'AI safety systems...',
    });

    // [Test 1] 401 unauthenticated request
    console.log('[Test 1] GET /api/applications/follow-ups/due without token (expect 401)...');
    await request(app)
      .get('/api/applications/follow-ups/due')
      .expect(401);
    console.log('  ✔ Correctly rejected unauthenticated request');

    // [Test 2] Empty state when no applications exist
    console.log('[Test 2] Empty due follow-ups when no applications exist...');
    const emptyRes = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(emptyRes.body.count, 0);
    assert.deepStrictEqual(emptyRes.body.dueFollowUps, []);
    assert.ok(emptyRes.body.asOf, 'Response includes asOf timestamp');
    console.log('  ✔ Empty state returned correctly with count 0');

    // Seed applications with various nextFollowUpAt dates
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
    const threeDaysLater = new Date(now + 3 * 24 * 60 * 60 * 1000);

    // Overdue application 1 (most overdue: 2 days ago)
    const overdueApp1 = await Application.create({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      status: 'applied',
      resumeId: resume._id,
      jdId: jdStripe._id,
      appliedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: twoDaysAgo,
      notes: 'Follow up with recruiter on application status',
    });

    // Overdue application 2 (overdue: 1 hour ago)
    const overdueApp2 = await Application.create({
      userId: userA._id,
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
      status: 'interviewing',
      resumeId: resume._id,
      jdId: jdAnthropic._id,
      appliedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: oneHourAgo,
      notes: 'Send thank you email following technical interview',
    });

    // Future application (not due yet: 3 days in future)
    await Application.create({
      userId: userA._id,
      company: 'OpenAI',
      roleTitle: 'Research Engineer',
      status: 'applied',
      appliedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: threeDaysLater,
      notes: 'Waiting for initial response',
    });

    // Application with no follow-up scheduled (null)
    await Application.create({
      userId: userA._id,
      company: 'Google',
      roleTitle: 'Software Engineer',
      status: 'wishlist',
      nextFollowUpAt: null,
    });

    // User B overdue application (should NOT be returned to User A)
    await Application.create({
      userId: userB._id,
      company: 'Meta',
      roleTitle: 'Production Engineer',
      status: 'applied',
      nextFollowUpAt: twoDaysAgo,
    });

    // [Test 3] GET due follow-ups for User A
    console.log('[Test 3] GET due follow-ups for User A (expect exactly 2 overdue apps)...');
    const dueRes = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.strictEqual(dueRes.body.count, 2);
    assert.strictEqual(dueRes.body.dueFollowUps.length, 2);
    assert.strictEqual(dueRes.body.applications.length, 2);

    // Verify ordering: most overdue first (twoDaysAgo before oneHourAgo)
    const firstDue = dueRes.body.dueFollowUps[0];
    const secondDue = dueRes.body.dueFollowUps[1];
    assert.strictEqual(firstDue.company, 'Stripe');
    assert.strictEqual(secondDue.company, 'Anthropic');
    assert.ok(new Date(firstDue.nextFollowUpAt) <= new Date(secondDue.nextFollowUpAt));
    console.log('  ✔ Correctly returned 2 overdue applications in chronological order (most overdue first)');

    // [Test 4] Population of relational fields
    console.log('[Test 4] Verifying populated relation fields in due follow-ups...');
    assert.strictEqual(firstDue.jdId.company, 'Stripe');
    assert.strictEqual(firstDue.jdId.roleTitle, 'Staff Infrastructure Engineer');
    assert.strictEqual(firstDue.resumeId.originalFilename, 'resume.pdf');
    console.log('  ✔ Relational references (jdId, resumeId) populated correctly');

    // [Test 5] Tenant isolation: User B's due follow-ups
    console.log('[Test 5] Tenant isolation: verifying User B only receives their own due follow-ups...');
    const userBRes = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    assert.strictEqual(userBRes.body.count, 1);
    assert.strictEqual(userBRes.body.dueFollowUps[0].company, 'Meta');
    console.log('  ✔ User B isolated from User A (count: 1, Meta)');

    // [Test 6] Route conflict check: ensure /follow-ups/due is not caught as /:id
    console.log('[Test 6] Verifying route precedence: /follow-ups/due vs /:id...');
    // If /follow-ups/due was caught by /:id, it would return { application: ... } or 400/404
    assert.strictEqual(dueRes.body.dueFollowUps !== undefined, true);
    assert.strictEqual(dueRes.body.application, undefined);
    console.log('  ✔ Route precedence confirmed: /follow-ups/due correctly handled by getDueFollowUps');

    console.log('\n🎉 ALL FOLLOW-UP DUE ENDPOINT TESTS PASSED SUCCESSFULLY!\n');
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
  testFollowUpDueEndpoint().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testFollowUpDueEndpoint };
