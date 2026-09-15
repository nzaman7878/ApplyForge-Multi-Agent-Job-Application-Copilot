const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let authToken;
let otherUserToken;
let testUserId;

describe('Phase 90: Dashboard E2E & Telemetry Flow Smoke Test', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'dashboard-test-secret-key-12345';
    process.env.JWT_REFRESH_SECRET = 'dashboard-test-refresh-secret-12345';

    await mongoose.connect(uri);
    const indexExport = require('../src/index');
    app = indexExport.app || indexExport;

    // 1. Register main test user
    const resUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dashboard Tester',
        email: 'dashboard-tester@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(resUser.status, 201);
    authToken = resUser.body.token || resUser.body.accessToken;
    testUserId = resUser.body.user.id || resUser.body.user._id;

    // 2. Register secondary user for tenant isolation
    const resOther = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Isolated User',
        email: 'isolated-user@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(resOther.status, 201);
    otherUserToken = resOther.body.token || resOther.body.accessToken;

    // 3. Seed test applications for main user
    const Application = require('../src/models/Application');
    const now = new Date();

    const testApps = [
      // High fit score (>=85), got response
      {
        userId: testUserId,
        company: 'Stripe',
        roleTitle: 'Staff Engineer',
        status: 'offer',
        fitScore: { score: 95, tier: 'strong' },
        appliedAt: new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000), // 2 weeks ago
        statusHistory: [
          { status: 'applied', changedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          { status: 'interviewing', changedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          { status: 'offer', changedAt: now },
        ],
      },
      // High fit score (88), interviewing
      {
        userId: testUserId,
        company: 'Linear',
        roleTitle: 'Senior Frontend',
        status: 'interviewing',
        fitScore: { score: 88, tier: 'strong' },
        appliedAt: new Date(now.getTime() - 1 * 7 * 24 * 60 * 60 * 1000), // 1 week ago
        nextFollowUpAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Due 2 hours ago
        statusHistory: [
          { status: 'applied', changedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          { status: 'interviewing', changedAt: now },
        ],
      },
      // Moderate fit score (72), applied, overdue follow-up
      {
        userId: testUserId,
        company: 'Vercel',
        roleTitle: 'Platform Engineer',
        status: 'applied',
        fitScore: { score: 72, tier: 'moderate' },
        appliedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        nextFollowUpAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Due yesterday
      },
      // Stretch fit score (35), rejected
      {
        userId: testUserId,
        company: 'Google',
        roleTitle: 'Systems Architect',
        status: 'rejected',
        fitScore: { score: 35, tier: 'stretch' },
        appliedAt: new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000), // 4 weeks ago
      },
      // Wishlist application (drafted)
      {
        userId: testUserId,
        company: 'Apple',
        roleTitle: 'Cloud Engineer',
        status: 'wishlist',
        fitScore: { score: 65, tier: 'moderate' },
        appliedAt: now,
      },
    ];

    await Application.insertMany(testApps);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('1. GET /api/analytics/summary returns correct CRM aggregate metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    const summary = res.body.summary;
    assert.ok(summary);

    // Total should be 5
    assert.strictEqual(summary.total, 5);
    // Submitted (non-wishlist) should be 4
    assert.strictEqual(summary.submittedCount, 4);
    // Interviewing (1) + Offer (1) = 2 responses
    assert.strictEqual(summary.responseCount, 2);
    // Response rate = 2 / 4 = 50.0%
    assert.strictEqual(summary.responseRate, 50.0);
    // Offer rate = 1 / 4 = 25.0%
    assert.strictEqual(summary.offerRate, 25.0);

    // Status counts
    assert.strictEqual(summary.byStatus.wishlist, 1);
    assert.strictEqual(summary.byStatus.applied, 1);
    assert.strictEqual(summary.byStatus.interviewing, 1);
    assert.strictEqual(summary.byStatus.offer, 1);
    assert.strictEqual(summary.byStatus.rejected, 1);

    // Average fit score: (95 + 88 + 72 + 35 + 65) / 5 = 355 / 5 = 71
    assert.strictEqual(summary.avgFitScore, 71);
    assert.strictEqual(summary.scoredApplicationsCount, 5);
  });

  it('2. GET /api/analytics/timeline returns 12-week velocity buckets with counts', async () => {
    const res = await request(app)
      .get('/api/analytics/timeline')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.timeline));
    assert.strictEqual(res.body.timeline.length, 12);

    // Validate week structure
    const currentWeek = res.body.timeline[11];
    assert.ok(currentWeek.weekStart);
    assert.ok(currentWeek.weekEnd);
    assert.ok(currentWeek.label);
    assert.ok(typeof currentWeek.count === 'number');

    // Total applications in 12-week window should equal total created
    assert.strictEqual(res.body.totalApplicationsOverall, 5);
  });

  it('3. GET /api/analytics/score-vs-response categorizes applications into fit bands', async () => {
    const res = await request(app)
      .get('/api/analytics/score-vs-response')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    const { bands, tiers, totalScored, unscoredCount } = res.body;

    assert.strictEqual(totalScored, 5);
    assert.strictEqual(unscoredCount, 0);

    // Bands check
    assert.ok(Array.isArray(bands));
    const strongBand = bands.find((b) => b.band === '85-100');
    assert.ok(strongBand);
    assert.strictEqual(strongBand.total, 2); // Stripe (95) and Linear (88)
    assert.strictEqual(strongBand.responses, 2); // Both got interviews/offers
    assert.strictEqual(strongBand.responseRate, 100);

    const stretchBand = bands.find((b) => b.band === '0-59');
    assert.ok(stretchBand);
    assert.strictEqual(stretchBand.total, 1); // Google (35)
    assert.strictEqual(stretchBand.responses, 0);
    assert.strictEqual(stretchBand.responseRate, 0);

    // Tiers check
    assert.strictEqual(tiers.strong.total, 2);
    assert.strictEqual(tiers.strong.responses, 2);
    assert.strictEqual(tiers.moderate.total, 2); // Vercel (72), Apple (65)
    assert.strictEqual(tiers.stretch.total, 1); // Google (35)
  });

  it('4. GET /api/applications?limit=6 returns the recent applications sorted by createdAt desc', async () => {
    const res = await request(app)
      .get('/api/applications?limit=6')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.applications));
    assert.strictEqual(res.body.applications.length, 5);
    assert.strictEqual(res.body.total, 5);

    // Verify application schema contains company, roleTitle, status, and fitScore
    const firstApp = res.body.applications[0];
    assert.ok(firstApp.company);
    assert.ok(firstApp.roleTitle);
    assert.ok(firstApp.status);
    assert.ok(firstApp.fitScore);
  });

  it('5. GET /api/applications/follow-ups/due surfaces overdue follow-ups', async () => {
    const res = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.dueFollowUps));
    // Linear (due 2 hours ago) and Vercel (due 1 day ago) should be due
    assert.strictEqual(res.body.count, 2);
    assert.strictEqual(res.body.dueFollowUps.length, 2);

    const companies = res.body.dueFollowUps.map((a) => a.company);
    assert.ok(companies.includes('Linear'));
    assert.ok(companies.includes('Vercel'));
  });

  it('6. Tenant isolation ensures other user has zero applications and empty metrics', async () => {
    const resSummary = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${otherUserToken}`);

    assert.strictEqual(resSummary.status, 200);
    assert.strictEqual(resSummary.body.summary.total, 0);
    assert.strictEqual(resSummary.body.summary.responseRate, 0);
    assert.strictEqual(resSummary.body.summary.avgFitScore, 0);

    const resApps = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${otherUserToken}`);

    assert.strictEqual(resApps.status, 200);
    assert.strictEqual(resApps.body.total, 0);
    assert.strictEqual(resApps.body.applications.length, 0);

    const resFollowUps = await request(app)
      .get('/api/applications/follow-ups/due')
      .set('Authorization', `Bearer ${otherUserToken}`);

    assert.strictEqual(resFollowUps.status, 200);
    assert.strictEqual(resFollowUps.body.count, 0);
  });
});
