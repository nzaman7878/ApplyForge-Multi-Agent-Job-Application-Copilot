const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5008';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const { signToken } = require('../src/utils/jwt');
const validateStatus = require('../src/middleware/validateStatus');

async function testStatusTransition() {
  console.log('🧪 Testing Status Transition Validation & History Tracking (Phase 73)...\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // Create test user
    const user = new User({
      name: 'Sarah Connor',
      email: 'sarah@skyline.dev',
      passwordHash: 'Hash123!',
    });
    await user.save();
    const token = signToken(user._id);

    // [Test 1] Validate statusHistory initialized on model creation
    console.log('[Test 1] Validating statusHistory initialized on creation...');
    const appDoc = new Application({
      userId: user._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      status: 'wishlist',
    });
    await appDoc.save();

    assert.ok(Array.isArray(appDoc.statusHistory), 'statusHistory must be an array');
    assert.strictEqual(appDoc.statusHistory.length, 1);
    assert.strictEqual(appDoc.statusHistory[0].status, 'wishlist');
    assert.ok(appDoc.statusHistory[0].changedAt instanceof Date);
    console.log('  ✔ statusHistory successfully initialized with [ { status: "wishlist", changedAt } ]');

    // [Test 2] Model pre-save tracking status transitions
    console.log('[Test 2] Tracking model status transitions (wishlist -> applied -> interviewing)...');
    appDoc.status = 'applied';
    await appDoc.save();

    assert.strictEqual(appDoc.statusHistory.length, 2);
    assert.strictEqual(appDoc.statusHistory[1].status, 'applied');

    appDoc.status = 'interviewing';
    await appDoc.save();

    assert.strictEqual(appDoc.statusHistory.length, 3);
    assert.strictEqual(appDoc.statusHistory[2].status, 'interviewing');

    // Saving without status change should NOT append duplicate history entry
    appDoc.notes = 'Added some notes without changing status';
    await appDoc.save();
    assert.strictEqual(appDoc.statusHistory.length, 3, 'Duplicate entry must not be added when status unchanged');
    console.log('  ✔ Pre-save hook correctly tracked transitions without duplicates');

    // [Test 3] Middleware: validateStatus directly
    console.log('[Test 3] Unit testing validateStatus middleware function...');
    let nextCalled = false;
    const reqValid = { body: { status: 'offer' } };
    const resMock = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
    };

    validateStatus(reqValid, resMock, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'Next must be called for valid status');
    assert.strictEqual(reqValid.body.status, 'offer');

    // Invalid status in middleware
    const reqInvalid = { body: { status: 'invalid_status_xyz' } };
    const resInvalid = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
    };

    validateStatus(reqInvalid, resInvalid, () => {
      assert.fail('Next should not be called for invalid status');
    });
    assert.strictEqual(resInvalid.statusCode, 400);
    assert.strictEqual(resInvalid.body.error, 'Invalid status');
    console.log('  ✔ validateStatus middleware validated valid and rejected invalid statuses');

    // [Test 4] PATCH /api/applications/:id with valid status transition
    console.log('[Test 4] PATCH /api/applications/:id transition from interviewing -> offer...');
    const patchRes = await request(app)
      .patch(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'offer',
        notes: 'Received formal offer letter!',
      })
      .expect(200);

    const updatedApp = patchRes.body.application;
    assert.strictEqual(updatedApp.status, 'offer');
    assert.strictEqual(updatedApp.statusHistory.length, 4);
    assert.strictEqual(updatedApp.statusHistory[3].status, 'offer');
    console.log('  ✔ PATCH transitioned status to "offer" and recorded in statusHistory');

    // [Test 5] PATCH /api/applications/:id rejecting invalid status enum (400)
    console.log('[Test 5] PATCH /api/applications/:id with invalid status enum (expect 400)...');
    const invalidRes = await request(app)
      .patch(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired_pending' })
      .expect(400);

    assert.strictEqual(invalidRes.body.error, 'Invalid status');
    assert.ok(Array.isArray(invalidRes.body.validStatuses));
    console.log('  ✔ PATCH rejected invalid status with descriptive 400 response');

    // [Test 6] GET /api/applications/:id retrieves complete statusHistory
    console.log('[Test 6] GET /api/applications/:id verifying statusHistory audit trail...');
    const getRes = await request(app)
      .get(`/api/applications/${appDoc._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const fetchedApp = getRes.body.application;
    assert.strictEqual(fetchedApp.statusHistory.length, 4);
    const progression = fetchedApp.statusHistory.map((h) => h.status);
    assert.deepStrictEqual(progression, ['wishlist', 'applied', 'interviewing', 'offer']);
    console.log('  ✔ Complete status progression retrieved:', progression.join(' ➔ '));

    console.log('\n🎉 ALL STATUS TRANSITION & HISTORY TESTS PASSED!\n');
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
  testStatusTransition().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = { testStatusTransition };
