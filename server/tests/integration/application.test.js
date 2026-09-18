const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5013';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Resume = require('../../src/models/Resume');
const JobDescription = require('../../src/models/JobDescription');
const Application = require('../../src/models/Application');
const PipelineRun = require('../../src/models/PipelineRun');
const { signToken } = require('../../src/utils/jwt');

describe('Application Endpoints Integration Tests', () => {
  let mongoServer;
  let userA;
  let tokenA;
  let userB;
  let tokenB;
  let resume;
  let jd;
  let pipelineRun;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    userA = new User({
      name: 'Sarah Connor',
      email: 'sarah.app@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userA.save();
    tokenA = signToken(userA._id);

    userB = new User({
      name: 'John Connor',
      email: 'john.app@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userB.save();
    tokenB = signToken(userB._id);

    resume = await Resume.create({
      userId: userA._id,
      originalFilename: 'resume.pdf',
      storedFilename: 'resume-123.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileHash: 'abcdef1234567890',
      rawText: 'Software Engineer with Node.js and React experience.',
    });

    jd = await JobDescription.create({
      userId: userA._id,
      company: 'Stripe',
      roleTitle: 'Staff Infrastructure Engineer',
      rawText: 'Looking for distributed systems experts.',
    });

    pipelineRun = await PipelineRun.create({
      userId: userA._id,
      resumeId: resume._id,
      jdId: jd._id,
      runId: 'run-uuid-pipeline-app-test',
      status: 'awaiting_review',
      state: {
        tailoredBullets: [{ tailoredBullet: 'Optimized high-throughput payment gateways' }],
        atsReport: { overallScore: 92 },
        coverLetter: { subject: 'Staff Engineer Application' },
        fitScore: { score: 95, tier: 'strong' },
      },
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  let createdApplication = null;
  let extraAppId = null;

  describe('POST /api/applications (Create)', () => {
    it('should reject unauthenticated create request (401)', async () => {
      await request(app).post('/api/applications').send({ company: 'Stripe' }).expect(401);
    });

    it('should reject creation with missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.details.some((d) => d.field === 'company')).toBe(true);
      expect(res.body.details.some((d) => d.field === 'roleTitle')).toBe(true);
    });

    it('should create an application with full CRM and pipeline data (201)', async () => {
      const res = await request(app)
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
          nextFollowUpAt: new Date('2026-09-25T10:00:00.000Z'),
        })
        .expect(201);

      createdApplication = res.body.application;
      expect(createdApplication).toBeDefined();
      expect(createdApplication.company).toBe('Stripe');
      expect(createdApplication.roleTitle).toBe('Staff Infrastructure Engineer');
      expect(createdApplication.status).toBe('applied');
      expect(createdApplication.fitScore.score).toBe(95);
      expect(createdApplication.atsReport.overallScore).toBe(92);
    });
  });

  describe('GET /api/applications (List & Filter)', () => {
    beforeAll(async () => {
      // Seed additional applications for pagination and filter tests
      const appWishlist = await Application.create({
        userId: userA._id,
        company: 'Anthropic',
        roleTitle: 'Systems Architect',
        status: 'wishlist',
        jobDescription: 'AI safety systems',
      });
      extraAppId = appWishlist._id;

      await Application.create({
        userId: userA._id,
        company: 'OpenAI',
        roleTitle: 'Kernel Engineer',
        status: 'interviewing',
        jobDescription: 'GPU kernel engineering',
      });

      await Application.create({
        userId: userA._id,
        company: 'Google',
        roleTitle: 'Principal Engineer',
        status: 'offer',
        jobDescription: 'Cloud infrastructure',
      });
    });

    it('should paginate results correctly with limit and page params', async () => {
      const res = await request(app)
        .get('/api/applications?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.count).toBe(2);
      expect(res.body.total).toBe(4);
      expect(res.body.page).toBe(1);
      expect(res.body.totalPages).toBe(2);
    });

    it('should filter applications by status', async () => {
      const res = await request(app)
        .get('/api/applications?status=interviewing')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.applications[0].company).toBe('OpenAI');
      expect(res.body.applications[0].status).toBe('interviewing');
    });

    it('should enforce user tenant isolation (User B sees 0 applications)', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.count).toBe(0);
    });
  });

  describe('GET /api/applications/:id (Detail)', () => {
    it('should retrieve full application detail by ObjectId', async () => {
      const res = await request(app)
        .get(`/api/applications/${createdApplication.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.application.company).toBe('Stripe');
      expect(res.body.application.roleTitle).toBe('Staff Infrastructure Engineer');
      expect(res.body.application.fitScore.score).toBe(95);
    });

    it('should retrieve application detail using runId fallback', async () => {
      const res = await request(app)
        .get(`/api/applications/${pipelineRun.runId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.application.company).toBe('Stripe');
    });

    it('should prevent User B from accessing User A application (403)', async () => {
      await request(app)
        .get(`/api/applications/${createdApplication.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('should return 404 for non-existent application ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/applications/${fakeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe('PATCH & PUT /api/applications/:id (Update)', () => {
    it('should update status, follow-up dates, and notes via PATCH (200)', async () => {
      const nextFollowUp = new Date('2026-09-30T15:00:00.000Z');
      const res = await request(app)
        .patch(`/api/applications/${createdApplication.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'interviewing',
          lastFollowUpAt: new Date('2026-09-18T12:00:00.000Z'),
          nextFollowUpAt: nextFollowUp,
          notes: 'Passed recruiter screen; technical interview next.',
        })
        .expect(200);

      expect(res.body.application.status).toBe('interviewing');
      expect(res.body.application.notes).toBe('Passed recruiter screen; technical interview next.');
      expect(new Date(res.body.application.nextFollowUpAt).toISOString()).toBe(
        nextFollowUp.toISOString()
      );
    });

    it('should reject invalid status via PATCH (400)', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplication.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'invalid_status_xyz' })
        .expect(400);

      expect(res.body.error).toBe('Invalid status');
    });

    it('should update notes via PUT (200)', async () => {
      const res = await request(app)
        .put(`/api/applications/${createdApplication.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notes: 'Updated notes through PUT' })
        .expect(200);

      expect(res.body.application.notes).toBe('Updated notes through PUT');
    });
  });

  describe('DELETE /api/applications/:id', () => {
    it('should prevent User B from deleting User A application (403)', async () => {
      await request(app)
        .delete(`/api/applications/${extraAppId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('should allow User A to delete application (200)', async () => {
      const res = await request(app)
        .delete(`/api/applications/${extraAppId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.id.toString()).toBe(extraAppId.toString());

      // Confirm 404 on subsequent fetch
      await request(app)
        .get(`/api/applications/${extraAppId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });
});
