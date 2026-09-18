const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5012';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Resume = require('../../src/models/Resume');
const JobDescription = require('../../src/models/JobDescription');
const { signToken } = require('../../src/utils/jwt');
const { resetRunsStore } = require('../../src/controllers/pipeline.controller');

describe('Pipeline Endpoints Integration Tests', () => {
  let mongoServer;
  let userA;
  let tokenA;
  let userB;
  let tokenB;
  let resumeA;
  let jdA;
  let resumeB;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    resetRunsStore();

    userA = new User({
      name: 'Alice Pipeline',
      email: 'alice.pipeline@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userA.save();
    tokenA = signToken(userA._id);

    userB = new User({
      name: 'Bob Pipeline',
      email: 'bob.pipeline@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userB.save();
    tokenB = signToken(userB._id);

    resumeA = new Resume({
      userId: userA._id,
      originalFilename: 'alice_cv.pdf',
      rawText: 'Alice Pipeline\nSenior Backend\nSkills: Node.js, PostgreSQL, Docker',
      parsedSections: {
        contact: { name: 'Alice Pipeline', email: 'alice.pipeline@applyforge.test' },
        summary: 'Senior distributed systems developer with 6+ years experience.',
        skills: ['Node.js', 'PostgreSQL', 'Docker'],
        experience: [
          {
            company: 'CloudTech',
            title: 'Senior Backend Engineer',
            bulletPoints: [
              'Engineered scalable microservices handling 40k RPS with Node.js and PostgreSQL.',
            ],
          },
        ],
      },
    });
    await resumeA.save();

    jdA = new JobDescription({
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

    resumeB = new Resume({
      userId: userB._id,
      originalFilename: 'bob_cv.docx',
      rawText: 'Bob Pipeline\nSecurity Engineer',
      parsedSections: {
        contact: { name: 'Bob Pipeline', email: 'bob.pipeline@applyforge.test' },
        skills: ['Python', 'Linux'],
      },
    });
    await resumeB.save();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  let createdRunId = '';

  describe('POST /api/pipeline/run', () => {
    it('should reject unauthenticated request (401)', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .send({ resumeId: resumeA._id, jdId: jdA._id })
        .expect(401);
      expect(res.body.code).toBe('TOKEN_MISSING');
    });

    it('should reject request with missing parameters (400)', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject request with invalid ObjectId format (400)', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeId: 'not-a-valid-id', jdId: '123' })
        .expect(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 404 when resume document does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeId: fakeId, jdId: jdA._id })
        .expect(404);
      expect(res.body.error).toBe('Resume not found');
    });

    it('should prevent User A from using User B documents (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeId: resumeB._id, jdId: jdA._id })
        .expect(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should successfully execute pipeline run and pause at awaiting_review (201)', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeId: resumeA._id, jdId: jdA._id })
        .expect(201);

      expect(res.body).toHaveProperty('runId');
      createdRunId = res.body.runId;
      expect(res.body.status).toBe('awaiting_review');
      expect(res.body).toHaveProperty('state');

      const { state } = res.body;
      expect(state.structuredResume).toBeDefined();
      expect(state.structuredJD).toBeDefined();
      expect(Array.isArray(state.tailoredBullets)).toBe(true);
      expect(state.tailoredBullets.length).toBeGreaterThan(0);
      expect(state.atsReport).toBeDefined();
      expect(typeof state.atsReport.overallScore).toBe('number');
      expect(state.coverLetter).toBeDefined();
      expect(state.coverLetter.subject).toBeDefined();
      expect(state.fitScore).toBeDefined();
      expect(typeof state.fitScore.score).toBe('number');
    });
  });

  describe('GET /api/pipeline/:runId', () => {
    it('should reject unauthenticated request (401)', async () => {
      await request(app).get(`/api/pipeline/${createdRunId}`).expect(401);
    });

    it('should return 404 for unknown runId', async () => {
      const res = await request(app)
        .get('/api/pipeline/non-existent-run-id-999')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
      expect(res.body.error).toBe('Pipeline run not found');
    });

    it('should prevent User B from accessing User A pipeline run (403)', async () => {
      const res = await request(app)
        .get(`/api/pipeline/${createdRunId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should return pipeline run state for authorized User A (200)', async () => {
      const res = await request(app)
        .get(`/api/pipeline/${createdRunId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.runId).toBe(createdRunId);
      expect(res.body.status).toBe('awaiting_review');
      expect(res.body.state.atsReport.overallScore).toBeDefined();
    });
  });

  describe('POST /api/pipeline/:runId/edit', () => {
    it('should reject unauthenticated edit request (401)', async () => {
      await request(app)
        .post(`/api/pipeline/${createdRunId}/edit`)
        .send({ userEdits: { notes: 'Add Redis' } })
        .expect(401);
    });

    it('should prevent User B from editing User A pipeline run (403)', async () => {
      const res = await request(app)
        .post(`/api/pipeline/${createdRunId}/edit`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ userEdits: { notes: 'Unauthorized edit' } })
        .expect(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should accept user edits and loop back to awaiting_review (200)', async () => {
      const res = await request(app)
        .post(`/api/pipeline/${createdRunId}/edit`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          userEdits: {
            notes: 'Emphasize high availability distributed caching and 99.99% uptime.',
          },
        })
        .expect(200);

      expect(res.body.runId).toBe(createdRunId);
      expect(res.body.status).toBe('awaiting_review');
      expect(res.body.state.humanApproved).toBe(false);
      expect(Array.isArray(res.body.state.tailoredBullets)).toBe(true);
    });
  });

  describe('POST /api/pipeline/:runId/approve', () => {
    it('should reject unauthenticated approve request (401)', async () => {
      await request(app).post(`/api/pipeline/${createdRunId}/approve`).expect(401);
    });

    it('should prevent User B from approving User A pipeline run (403)', async () => {
      const res = await request(app)
        .post(`/api/pipeline/${createdRunId}/approve`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should approve pipeline run and transition status to saved (200)', async () => {
      const res = await request(app)
        .post(`/api/pipeline/${createdRunId}/approve`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.runId).toBe(createdRunId);
      expect(res.body.status).toBe('saved');
      expect(res.body.state.humanApproved).toBe(true);

      // Verify status persists on subsequent GET
      const getRes = await request(app)
        .get(`/api/pipeline/${createdRunId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(getRes.body.status).toBe('saved');
      expect(getRes.body.state.humanApproved).toBe(true);
    });
  });
});
