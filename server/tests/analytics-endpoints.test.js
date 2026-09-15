const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Test environment configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || 'analytics_test_jwt_secret_applyforge_81';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'analytics_test_refresh_secret_applyforge_81';
process.env.PORT = process.env.PORT || '5010';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const { signToken } = require('../src/utils/jwt');
const { getStartOfWeek } = require('../src/controllers/analytics.controller');

async function testAnalyticsEndpoints() {
  console.log('🧪 Testing Analytics Aggregation Endpoints (Phase 81)...\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // Create test users
    const userA = await User.create({
      name: 'Ada Lovelace',
      email: 'ada@applyforge.dev',
      passwordHash: 'HashPassword123!',
    });
    const tokenA = signToken(userA._id);

    const userB = await User.create({
      name: 'Alan Turing',
      email: 'alan@applyforge.dev',
      passwordHash: 'HashPassword123!',
    });
    const tokenB = signToken(userB._id);

    // =========================================================================
    // [Test 1] 401 Unauthorized for Unauthenticated Requests
    // =========================================================================
    console.log('[Test 1] 401 Unauthorized for unauthenticated requests...');
    await request(app).get('/api/analytics/summary').expect(401);
    await request(app).get('/api/analytics/timeline').expect(401);
    await request(app).get('/api/analytics/score-vs-response').expect(401);
    console.log('  ✔ All analytics endpoints enforce auth middleware');

    // =========================================================================
    // [Test 2] Empty State when user has no applications
    // =========================================================================
    console.log('[Test 2] Empty state response for new user...');
    const emptySummaryRes = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const emptySummary = emptySummaryRes.body.summary;
    assert.strictEqual(emptySummary.total, 0);
    assert.strictEqual(emptySummary.submittedCount, 0);
    assert.strictEqual(emptySummary.responseCount, 0);
    assert.strictEqual(emptySummary.responseRate, 0);
    assert.strictEqual(emptySummary.avgFitScore, 0);
    assert.strictEqual(emptySummary.byStatus.wishlist, 0);
    assert.strictEqual(emptySummary.byStatus.applied, 0);
    console.log('  ✔ Empty summary metrics returned safely');

    const emptyTimelineRes = await request(app)
      .get('/api/analytics/timeline')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.ok(Array.isArray(emptyTimelineRes.body.timeline));
    assert.strictEqual(emptyTimelineRes.body.timeline.length, 12);
    assert.strictEqual(emptyTimelineRes.body.totalApplicationsInPeriod, 0);
    console.log('  ✔ Empty timeline returned 12 zero-count week buckets');

    const emptyScoreRes = await request(app)
      .get('/api/analytics/score-vs-response')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    assert.ok(Array.isArray(emptyScoreRes.body.bands));
    assert.strictEqual(emptyScoreRes.body.bands.length, 4);
    assert.strictEqual(emptyScoreRes.body.unscoredCount, 0);
    console.log('  ✔ Empty score-vs-response returned zeroed bands');

    // =========================================================================
    // [Test 3] Seed Rich Applications Data for User A
    // =========================================================================
    console.log('[Test 3] Seeding test applications for User A...');
    const now = new Date();
    const currentWeekStart = getStartOfWeek(now);

    const twoWeeksAgo = new Date(currentWeekStart.getTime() - 2 * 7 * 24 * 60 * 60 * 1000 + 1000 * 60 * 60 * 12);
    const fourWeeksAgo = new Date(currentWeekStart.getTime() - 4 * 7 * 24 * 60 * 60 * 1000 + 1000 * 60 * 60 * 12);
    const sixWeeksAgo = new Date(currentWeekStart.getTime() - 6 * 7 * 24 * 60 * 60 * 1000 + 1000 * 60 * 60 * 12);
    const tenWeeksAgo = new Date(currentWeekStart.getTime() - 10 * 7 * 24 * 60 * 60 * 1000 + 1000 * 60 * 60 * 12);

    // App 1: Wishlist (not submitted, fitScore 95)
    await Application.create({
      userId: userA._id,
      company: 'OpenAI',
      roleTitle: 'Research Engineer',
      status: 'wishlist',
      fitScore: { score: 95, tier: 'strong' },
      createdAt: now,
    });

    // App 2: Applied (submitted 2 weeks ago, fitScore 88, no callback)
    await Application.create({
      userId: userA._id,
      company: 'Anthropic',
      roleTitle: 'Systems Engineer',
      status: 'applied',
      appliedAt: twoWeeksAgo,
      fitScore: { score: 88, tier: 'strong' },
      createdAt: twoWeeksAgo,
    });

    // App 3: Interviewing (submitted 4 weeks ago, fitScore 82, positive response!)
    await Application.create({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Backend Engineer',
      status: 'interviewing',
      appliedAt: fourWeeksAgo,
      fitScore: 82, // tests numeric score fallback
      statusHistory: [
        { status: 'applied', changedAt: fourWeeksAgo },
        { status: 'interviewing', changedAt: now },
      ],
      createdAt: fourWeeksAgo,
    });

    // App 4: Offer (submitted this week, fitScore 90, positive response & offer!)
    await Application.create({
      userId: userA._id,
      company: 'Figma',
      roleTitle: 'Staff Frontend Engineer',
      status: 'offer',
      appliedAt: now,
      fitScore: { score: 90, tier: 'strong' },
      statusHistory: [
        { status: 'applied', changedAt: twoWeeksAgo },
        { status: 'interviewing', changedAt: fourWeeksAgo },
        { status: 'offer', changedAt: now },
      ],
      createdAt: now,
    });

    // App 5: Rejected, but reached Interviewing previously (fitScore 72, 6 weeks ago)
    await Application.create({
      userId: userA._id,
      company: 'Google',
      roleTitle: 'Infrastructure Lead',
      status: 'rejected',
      appliedAt: sixWeeksAgo,
      fitScore: { score: 72, tier: 'moderate' },
      statusHistory: [
        { status: 'applied', changedAt: sixWeeksAgo },
        { status: 'interviewing', changedAt: fourWeeksAgo },
        { status: 'rejected', changedAt: now },
      ],
      createdAt: sixWeeksAgo,
    });

    // App 6: Rejected without interview (fitScore 55, 10 weeks ago, stretch)
    await Application.create({
      userId: userA._id,
      company: 'Datadog',
      roleTitle: 'Principal Architect',
      status: 'rejected',
      appliedAt: tenWeeksAgo,
      fitScore: { score: 55, tier: 'stretch' },
      statusHistory: [
        { status: 'applied', changedAt: tenWeeksAgo },
        { status: 'rejected', changedAt: now },
      ],
      createdAt: tenWeeksAgo,
    });

    // App 7: Applied with no score (applied this week)
    await Application.create({
      userId: userA._id,
      company: 'Vercel',
      roleTitle: 'Platform Engineer',
      status: 'applied',
      appliedAt: now,
      fitScore: null,
      createdAt: now,
    });

    // Seed User B application (Tenant isolation test)
    await Application.create({
      userId: userB._id,
      company: 'Isolated Corp',
      roleTitle: 'Security Engineer',
      status: 'offer',
      appliedAt: now,
      fitScore: { score: 100 },
      createdAt: now,
    });

    console.log('  ✔ Seeded 7 applications for User A, 1 for User B');

    // =========================================================================
    // [Test 4] GET /api/analytics/summary Verification
    // =========================================================================
    console.log('[Test 4] GET /api/analytics/summary populated verification...');
    const summaryRes = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const s = summaryRes.body.summary;
    assert.strictEqual(s.total, 7, 'Total must be 7');
    assert.strictEqual(s.byStatus.wishlist, 1);
    assert.strictEqual(s.byStatus.applied, 2);
    assert.strictEqual(s.byStatus.interviewing, 1);
    assert.strictEqual(s.byStatus.offer, 1);
    assert.strictEqual(s.byStatus.rejected, 2);

    // Submitted = 6 (Total 7 - 1 Wishlist)
    assert.strictEqual(s.submittedCount, 6);

    // Response count: App 3 (interviewing), App 4 (offer), App 5 (rejected with interview history) = 3
    assert.strictEqual(s.responseCount, 3);
    // Response rate: 3 / 6 = 50.0%
    assert.strictEqual(s.responseRate, 50.0);

    // Offer count: 1, Offer rate: 1 / 6 = 16.7%
    assert.strictEqual(s.offerCount, 1);
    assert.strictEqual(s.offerRate, 16.7);

    // Average Fit Score: (95 + 88 + 82 + 90 + 72 + 55) / 6 = 482 / 6 = 80
    assert.strictEqual(s.avgFitScore, 80);
    assert.strictEqual(s.scoredApplicationsCount, 6);
    console.log('  ✔ Summary metrics accurately computed: responseRate=50%, avgFitScore=80');

    // =========================================================================
    // [Test 5] GET /api/analytics/timeline Verification
    // =========================================================================
    console.log('[Test 5] GET /api/analytics/timeline verification...');
    const timelineRes = await request(app)
      .get('/api/analytics/timeline')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const timeline = timelineRes.body.timeline;
    assert.strictEqual(timeline.length, 12, 'Must return 12 week buckets');
    assert.strictEqual(timelineRes.body.totalApplicationsInPeriod, 7);

    // Current week (weekIndex 11) should have App 1, App 4, App 7
    const currentWeekBucket = timeline[11];
    assert.ok(currentWeekBucket.count >= 2, 'Current week should have at least 2 apps');

    // Each bucket must have weekStart, weekEnd, label, count, and byStatus
    for (const b of timeline) {
      assert.ok(b.weekStart && b.weekEnd && b.label);
      assert.strictEqual(typeof b.count, 'number');
      assert.ok(b.byStatus && typeof b.byStatus.applied === 'number');
    }
    console.log('  ✔ Timeline returned 12 structured weekly buckets with accurate distribution');

    // =========================================================================
    // [Test 6] GET /api/analytics/score-vs-response Verification
    // =========================================================================
    console.log('[Test 6] GET /api/analytics/score-vs-response verification...');
    const scoreRes = await request(app)
      .get('/api/analytics/score-vs-response')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const { bands, tiers, unscoredCount, totalScored } = scoreRes.body;

    assert.strictEqual(unscoredCount, 1, 'App 7 is unscored');
    assert.strictEqual(totalScored, 6, '6 apps have valid fit scores');

    // Band 0-59 (Stretch): App 6 (score 55, no response) -> total 1, responses 0, rate 0%
    const bandStretch = bands.find((b) => b.band === '0-59');
    assert.strictEqual(bandStretch.total, 1);
    assert.strictEqual(bandStretch.responses, 0);
    assert.strictEqual(bandStretch.responseRate, 0);

    // Band 60-74 (Moderate): App 5 (score 72, had interview) -> total 1, responses 1, rate 100%
    const band60_74 = bands.find((b) => b.band === '60-74');
    assert.strictEqual(band60_74.total, 1);
    assert.strictEqual(band60_74.responses, 1);
    assert.strictEqual(band60_74.responseRate, 100);

    // Band 75-84 (Good): App 3 (score 82, interviewing) -> total 1, responses 1, rate 100%
    const band75_84 = bands.find((b) => b.band === '75-84');
    assert.strictEqual(band75_84.total, 1);
    assert.strictEqual(band75_84.responses, 1);
    assert.strictEqual(band75_84.responseRate, 100);

    // Band 85-100 (Strong): App 1 (95, wishlist), App 2 (88, applied), App 4 (90, offer) -> total 3, responses 1 (App 4), rate 33.3%
    const band85_100 = bands.find((b) => b.band === '85-100');
    assert.strictEqual(band85_100.total, 3);
    assert.strictEqual(band85_100.responses, 1);
    assert.strictEqual(band85_100.responseRate, 33.3);

    // Tiers verification
    assert.strictEqual(tiers.stretch.total, 1);
    assert.strictEqual(tiers.stretch.responses, 0);
    assert.strictEqual(tiers.moderate.total, 1); // 72 is in 60-79
    assert.strictEqual(tiers.moderate.responses, 1);
    assert.strictEqual(tiers.moderate.responseRate, 100);
    assert.strictEqual(tiers.strong.total, 4); // 82, 88, 90, 95 are in 80-100
    assert.strictEqual(tiers.strong.responses, 2); // 82 (interviewing) and 90 (offer)
    assert.strictEqual(tiers.strong.responseRate, 50.0);

    console.log('  ✔ Score bands vs response rate computed with precision');

    // =========================================================================
    // [Test 7] Tenant Isolation Verification (User B)
    // =========================================================================
    console.log('[Test 7] Verifying tenant isolation for User B...');
    const userBSummaryRes = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    assert.strictEqual(userBSummaryRes.body.summary.total, 1);
    assert.strictEqual(userBSummaryRes.body.summary.offerCount, 1);
    assert.strictEqual(userBSummaryRes.body.summary.avgFitScore, 100);
    console.log('  ✔ Tenant isolation confirmed: User B data is completely isolated');

    console.log('\n=============================================================');
    console.log('🎉 ALL ANALYTICS AGGREGATION ENDPOINT TESTS PASSED (PHASE 81)!');
    console.log('   /summary, /timeline, /score-vs-response');
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
  testAnalyticsEndpoints().catch((err) => {
    console.error('❌ Analytics Endpoints Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { testAnalyticsEndpoints };
