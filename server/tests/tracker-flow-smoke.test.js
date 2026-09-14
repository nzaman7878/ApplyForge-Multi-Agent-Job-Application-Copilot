const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tracker_smoke_jwt_secret_applyforge_80';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'tracker_smoke_refresh_secret_applyforge_80';
process.env.PORT = process.env.PORT || '5009';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Application = require('../src/models/Application');

/**
 * End-to-End Smoke Test: Phase 80
 * Tracker Flow Walkthrough:
 * 1. Register User & Authenticate
 * 2. Create Applications via POST /api/applications (Drafted & Applied)
 * 3. List & Filter Applications (Kanban & Table data queries)
 * 4. Move Applications Through Statuses (Drafted ➔ Applied ➔ Interviewing ➔ Offer)
 * 5. Validate Status Transition Middleware & Timestamped Audit History
 * 6. Follow-up Reminders: Schedule Overdue ➔ Surface in Due Endpoint ➔ Snooze ➔ Mark Followed Up
 * 7. Application CRM Detail Inspection
 * 8. Clean Application Deletion
 */
async function runTrackerFlowSmokeTest() {
  console.log('🚀 [Phase 80] Starting Application Tracker CRM Flow E2E Smoke Test...\n');

  let mongoServer;

  try {
    // 0. Connect to In-Memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory test MongoDB instance');

    // =========================================================================
    // STEP 1: User Registration & Authentication
    // =========================================================================
    console.log('\n[Step 1] User Registration (POST /api/auth/register)...');
    const userPayload = {
      name: 'Alex Mercer',
      email: 'alex.mercer@applyforge.dev',
      password: 'SecurePassword123!',
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(userPayload)
      .expect(201);

    const token = registerRes.body.token || registerRes.body.accessToken;
    assert.ok(token, 'Registration must return access token');
    console.log(`  ✔ User registered: ${userPayload.email}`);

    // =========================================================================
    // STEP 2: Create Applications (POST /api/applications)
    // =========================================================================
    console.log('\n[Step 2] Creating Applications for Tracker CRM (POST /api/applications)...');

    // App 1: Stripe (Drafted)
    const stripePayload = {
      company: 'Stripe',
      roleTitle: 'Staff Distributed Systems Engineer',
      jobDescription: 'Architecting high-throughput payment settlement infrastructure and low-latency APIs.',
      tailoredResume: '• Architected distributed payment processing services handling 80,000 rps with Node.js and Redis.\n• Designed resilient Kafka message pipelines.',
      coverLetter: 'Dear Stripe Engineering Team,\nI am excited to contribute to your core infrastructure platform...',
      atsReport: {
        overallScore: 94,
        matchedKeywords: [
          { keyword: 'Node.js', importance: 'required', location: 'Experience' },
          { keyword: 'Distributed Systems', importance: 'required', location: 'Summary' },
          { keyword: 'Redis', importance: 'preferred', location: 'Experience' },
        ],
        missingKeywords: [],
      },
      fitScore: {
        score: 95,
        tier: 'strong',
        strengths: ['Deep distributed systems experience', 'Production high-throughput scaling'],
        gaps: [],
      },
      status: 'wishlist',
    };

    const createStripeRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send(stripePayload)
      .expect(201);

    const stripeApp = createStripeRes.body.application;
    assert.ok(stripeApp && stripeApp.id, 'Must return created Stripe application with id');
    assert.strictEqual(stripeApp.company, 'Stripe');
    assert.strictEqual(stripeApp.status, 'wishlist');
    assert.ok(Array.isArray(stripeApp.statusHistory), 'statusHistory must be initialized');
    assert.strictEqual(stripeApp.statusHistory.length, 1);
    assert.strictEqual(stripeApp.statusHistory[0].status, 'wishlist');
    console.log(`  ✔ Created Application 1: ${stripeApp.company} (${stripeApp.status}) - ID: ${stripeApp.id}`);

    // App 2: Anthropic (Applied)
    const anthropicPayload = {
      company: 'Anthropic',
      roleTitle: 'Research Platform Engineer',
      jobDescription: 'Scaling training clusters, distributed checkpoints, and model safety evaluations.',
      tailoredResume: '• Built distributed cluster orchestrators across 1,000+ GPUs with PyTorch and Ray.',
      coverLetter: 'Dear Anthropic Team,\nI am passionate about safe AI systems and scalable infrastructure...',
      atsReport: {
        overallScore: 89,
        matchedKeywords: [
          { keyword: 'Python', importance: 'required', location: 'Experience' },
          { keyword: 'Distributed Checkpoints', importance: 'required', location: 'Experience' },
        ],
        missingKeywords: [],
      },
      fitScore: {
        score: 91,
        tier: 'strong',
        strengths: ['High-performance cluster management'],
        gaps: [],
      },
      status: 'applied',
    };

    const createAnthropicRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send(anthropicPayload)
      .expect(201);

    const anthropicApp = createAnthropicRes.body.application;
    assert.ok(anthropicApp && anthropicApp.id, 'Must return created Anthropic application');
    assert.strictEqual(anthropicApp.company, 'Anthropic');
    assert.strictEqual(anthropicApp.status, 'applied');
    console.log(`  ✔ Created Application 2: ${anthropicApp.company} (${anthropicApp.status}) - ID: ${anthropicApp.id}`);

    // =========================================================================
    // STEP 3: List & Filter Applications (Kanban & Table Views)
    // =========================================================================
    console.log('\n[Step 3] Querying Tracker Applications (GET /api/applications)...');

    // All applications
    const listAllRes = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(listAllRes.body.total, 2);
    assert.strictEqual(listAllRes.body.applications.length, 2);
    console.log(`  ✔ Successfully listed all applications (Total: ${listAllRes.body.total})`);

    // Filter by status=wishlist
    const listDraftedRes = await request(app)
      .get('/api/applications?status=wishlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(listDraftedRes.body.total, 1);
    assert.strictEqual(listDraftedRes.body.applications[0].company, 'Stripe');
    console.log('  ✔ Filter status=wishlist (drafted) returned only Stripe');

    // Filter by status=applied
    const listAppliedRes = await request(app)
      .get('/api/applications?status=applied')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(listAppliedRes.body.total, 1);
    assert.strictEqual(listAppliedRes.body.applications[0].company, 'Anthropic');
    console.log('  ✔ Filter status=applied returned only Anthropic');

    // =========================================================================
    // STEP 4: Move Application Through Statuses (Kanban Drag & Table Transitions)
    // =========================================================================
    console.log('\n[Step 4] Moving Application Through Status Transitions (PATCH /api/applications/:id)...');

    // Transition 1: wishlist ➔ applied
    const moveAppliedRes = await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'applied' })
      .expect(200);

    assert.strictEqual(moveAppliedRes.body.application.status, 'applied');
    assert.strictEqual(moveAppliedRes.body.application.statusHistory.length, 2);
    assert.strictEqual(moveAppliedRes.body.application.statusHistory[1].status, 'applied');
    console.log('  ✔ Transition 1: wishlist ➔ applied recorded in statusHistory (2 events)');

    // Transition 2: applied ➔ interviewing
    const moveInterviewRes = await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'interviewing' })
      .expect(200);

    assert.strictEqual(moveInterviewRes.body.application.status, 'interviewing');
    assert.strictEqual(moveInterviewRes.body.application.statusHistory.length, 3);
    assert.strictEqual(moveInterviewRes.body.application.statusHistory[2].status, 'interviewing');
    console.log('  ✔ Transition 2: applied ➔ interviewing recorded in statusHistory (3 events)');

    // Transition 3: interviewing ➔ offer
    const moveOfferRes = await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'offer' })
      .expect(200);

    assert.strictEqual(moveOfferRes.body.application.status, 'offer');
    assert.strictEqual(moveOfferRes.body.application.statusHistory.length, 4);
    assert.strictEqual(moveOfferRes.body.application.statusHistory[3].status, 'offer');
    console.log('  ✔ Transition 3: interviewing ➔ offer recorded in statusHistory (4 events)');

    // Validation Guard: reject invalid status value
    const invalidStatusRes = await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'teleported' })
      .expect(400);

    assert.ok(
      invalidStatusRes.body.error === 'Invalid status' ||
        invalidStatusRes.body.message.includes('Invalid status')
    );
    console.log('  ✔ Correctly rejected invalid status transition ("teleported") with 400 Bad Request');

    // =========================================================================
    // STEP 5: Follow-Up Scheduler & Overdue Banner Surfacing
    // =========================================================================
    console.log('\n[Step 5] Follow-Up Scheduling, Overdue Detection & Snooze Actions...');

    // 5A: Schedule follow-up in the past (overdue)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nextFollowUpAt: yesterday })
      .expect(200);

    // 5B: Surface due follow-up in reminder endpoint (GET /api/applications/follow-ups/due)
    const dueRes1 = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(Array.isArray(dueRes1.body.applications), 'Must return array of due applications');
    assert.strictEqual(dueRes1.body.count, 1);
    assert.strictEqual(dueRes1.body.applications[0].company, 'Stripe');
    console.log(`  ✔ FollowUpBanner surfacing active: 1 application due (${dueRes1.body.applications[0].company})`);

    // 5C: Snooze Follow-Up by 3 days
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nextFollowUpAt: threeDaysLater })
      .expect(200);

    // Verify application is no longer due
    const dueRes2 = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(dueRes2.body.count, 0);
    console.log('  ✔ Snooze (+3d) confirmed: application removed from due reminders list');

    // 5D: Re-trigger due state, then Mark as Followed-Up
    await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nextFollowUpAt: yesterday })
      .expect(200);

    const nowIso = new Date().toISOString();
    const markFollowedUpRes = await request(app)
      .patch(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        lastFollowUpAt: nowIso,
        nextFollowUpAt: null,
      })
      .expect(200);

    assert.strictEqual(markFollowedUpRes.body.application.nextFollowUpAt, null);
    assert.ok(markFollowedUpRes.body.application.lastFollowUpAt, 'lastFollowUpAt must be set');

    // Verify 0 due applications remain
    const dueRes3 = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.strictEqual(dueRes3.body.count, 0);
    console.log('  ✔ Mark Followed Up confirmed: lastFollowUpAt recorded and reminder archived');

    // =========================================================================
    // STEP 6: Full Application CRM Detail Verification (GET /api/applications/:id)
    // =========================================================================
    console.log('\n[Step 6] Application Detail CRM Dossier Verification (GET /api/applications/:id)...');

    const detailRes = await request(app)
      .get(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const appDetail = detailRes.body.application;
    assert.strictEqual(appDetail.company, 'Stripe');
    assert.strictEqual(appDetail.roleTitle, 'Staff Distributed Systems Engineer');
    assert.strictEqual(appDetail.status, 'offer');
    assert.strictEqual(appDetail.statusHistory.length, 4);
    assert.strictEqual(appDetail.fitScore.score, 95);
    assert.ok(appDetail.lastFollowUpAt, 'lastFollowUpAt must be preserved in detail view');
    assert.strictEqual(appDetail.nextFollowUpAt, null);
    console.log(`  ✔ CRM Dossier verified for ${appDetail.company}: Status=${appDetail.status}, HistoryEvents=${appDetail.statusHistory.length}`);

    // =========================================================================
    // STEP 7: Application Deletion (DELETE /api/applications/:id)
    // =========================================================================
    console.log('\n[Step 7] Deleting Application (DELETE /api/applications/:id)...');

    await request(app)
      .delete(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify 404 on subsequent get
    await request(app)
      .get(`/api/applications/${stripeApp.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    console.log('  ✔ Application cleanly deleted and subsequent lookup returned 404');

    console.log('\n=============================================================');
    console.log('🎉 FULL APPLICATION TRACKER CRM FLOW E2E SMOKE TEST PASSED!');
    console.log('   create app → move statuses → set follow-up → detail → delete');
    console.log('=============================================================\n');
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
  runTrackerFlowSmokeTest().catch((err) => {
    console.error('❌ E2E Smoke Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runTrackerFlowSmokeTest };
