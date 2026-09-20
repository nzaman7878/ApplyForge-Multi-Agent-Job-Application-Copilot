const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5025';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Application = require('../../src/models/Application');
const { signToken } = require('../../src/utils/jwt');
const { recordApplicationEdits } = require('../../src/services/voiceLearning/editCollector');

describe('Voice Learning Edit History Collection Integration Tests', () => {
  let mongoServer;
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    userA = new User({
      name: 'Alex VoiceTester',
      email: 'alex.voice@applyforge.test',
      passwordHash: 'Password123!',
    });
    await userA.save();
    tokenA = signToken(userA._id);

    userB = new User({
      name: 'Bob Competitor',
      email: 'bob.voice@applyforge.test',
      passwordHash: 'Password123!',
    });
    await userB.save();
    tokenB = signToken(userB._id);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Direct Service Method: recordApplicationEdits', () => {
    it('should calculate diffs and store them in the userEdits array on an Application', async () => {
      const appDoc = new Application({
        userId: userA._id,
        company: 'Stripe',
        roleTitle: 'Staff Backend Engineer',
        status: 'applied',
        tailoredBullets: [
          'Spearheaded migration of core payments ledger to distributed Kafka stream architecture.',
          'Optimized database index usage for high QPS queries.',
        ],
        coverLetter: 'Dear Hiring Manager,\nI am writing to express my enthusiasm for Stripe.',
      });
      await appDoc.save();

      // Record edits on bullets and cover letter
      const result = await recordApplicationEdits(appDoc._id, {
        editedBullets: [
          'Led migration of payments ledger to Kafka streams reducing latency by 45%.',
          'Optimized database index usage for high QPS queries.', // unchanged
        ],
        editedCoverLetter:
          'Dear Stripe Team,\nI am eager to contribute to global payment primitives at Stripe.',
      });

      expect(result.success).toBe(true);
      expect(result.newEdits).toHaveLength(2); // 1 bullet + 1 cover letter

      const updated = await Application.findById(appDoc._id);
      expect(Array.isArray(updated.userEdits)).toBe(true);
      expect(updated.userEdits).toHaveLength(2);

      const bulletEdit = updated.userEdits.find((e) => e.type === 'bullet');
      expect(bulletEdit).toBeDefined();
      expect(bulletEdit.diff.actionVerbChanged).toBe(true);
      expect(bulletEdit.diff.originalActionVerb).toBe('Spearheaded');
      expect(bulletEdit.diff.editedActionVerb).toBe('Led');
      expect(bulletEdit.diff.addedWords).toContain('45');

      const coverLetterEdit = updated.userEdits.find((e) => e.type === 'cover_letter');
      expect(coverLetterEdit).toBeDefined();
      expect(coverLetterEdit.diff.addedWords).toContain('primitives');
    });

    it('should append subsequent edits to the existing userEdits array without overwriting past history', async () => {
      const appDoc = new Application({
        userId: userA._id,
        company: 'Datadog',
        roleTitle: 'Cloud Architect',
        status: 'applied',
        tailoredBullets: ['Built monitoring dashboards.'],
      });
      await appDoc.save();

      // Iteration 1
      await recordApplicationEdits(appDoc, {
        editedBullets: ['Engineered real-time monitoring dashboards with Prometheus.'],
      });

      // Iteration 2
      await recordApplicationEdits(appDoc, {
        editedBullets: ['Scaled real-time telemetry dashboards for 50M daily metrics.'],
      });

      const updated = await Application.findById(appDoc._id);
      expect(updated.userEdits).toHaveLength(2);
      expect(updated.userEdits[0].edited).toContain('Prometheus');
      expect(updated.userEdits[1].edited).toContain('50M');
    });
  });

  describe('Controller Integration via PATCH /api/applications/:id', () => {
    it('should automatically capture edit diffs into userEdits when candidate updates bullets via API', async () => {
      const appDoc = new Application({
        userId: userA._id,
        company: 'OpenAI',
        roleTitle: 'Research Engineer',
        status: 'applied',
        tailoredBullets: [
          'Orchestrated multi-node PyTorch training runs on Kubernetes GPU clusters.',
        ],
        coverLetter: 'Original letter draft.',
      });
      await appDoc.save();

      // Candidate updates tailoredBullets via PATCH endpoint
      const res = await request(app)
        .patch(`/api/applications/${appDoc._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          tailoredBullets: [
            'Led distributed PyTorch training across 512 H100 GPUs on Kubernetes.',
          ],
        })
        .expect(200);

      expect(res.body.application).toBeDefined();

      const savedApp = await Application.findById(appDoc._id);
      expect(Array.isArray(savedApp.userEdits)).toBe(true);
      expect(savedApp.userEdits.length).toBeGreaterThanOrEqual(1);

      const bulletDiff = savedApp.userEdits[0];
      expect(bulletDiff.type).toBe('bullet');
      expect(bulletDiff.diff.addedWords).toContain('512');
      expect(bulletDiff.diff.addedWords).toContain('h100');
    });
  });

  describe('Endpoints: GET /api/applications/:id/edits & Voice Profile', () => {
    let testApp;

    beforeEach(async () => {
      testApp = new Application({
        userId: userA._id,
        company: 'Snowflake',
        roleTitle: 'Data Platform Engineer',
        status: 'applied',
        tailoredBullets: ['Spearheaded query engine optimizations.'],
      });
      await testApp.save();

      await recordApplicationEdits(testApp, {
        editedBullets: ['Led query engine optimizations in C++ and Rust.'],
      });
    });

    it('should return edit history for the authorized application on GET /:id/edits', async () => {
      const res = await request(app)
        .get(`/api/applications/${testApp._id}/edits`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.count).toBe(1);
      expect(Array.isArray(res.body.edits)).toBe(true);
      expect(res.body.edits[0].diff.addedWords).toContain('rust');
    });

    it('should reject unauthorized user trying to read edits of another user (403)', async () => {
      await request(app)
        .get(`/api/applications/${testApp._id}/edits`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('should return aggregated voice profile on GET /api/applications/voice/profile', async () => {
      const res = await request(app)
        .get('/api/applications/voice/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.userId).toBe(userA._id.toString());
      expect(res.body.historyCount).toBeGreaterThanOrEqual(1);
      expect(res.body.signals).toBeDefined();
      expect(res.body.signals.totalEdits).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.signals.verbTransformations)).toBe(true);
      expect(Array.isArray(res.body.recentEdits)).toBe(true);
    });
  });
});
