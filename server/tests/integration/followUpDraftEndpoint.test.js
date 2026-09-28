const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5026';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Resume = require('../../src/models/Resume');
const JobDescription = require('../../src/models/JobDescription');
const Application = require('../../src/models/Application');
const { signToken } = require('../../src/utils/jwt');

describe('Follow-Up Email Draft Agent Integration Tests (Phase 108)', () => {
  let mongoServer;
  let userA;
  let tokenA;
  let userB;
  let tokenB;
  let sampleResume;
  let sampleJD;
  let sampleApp;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    userA = new User({
      name: 'Maya Lin',
      email: 'maya@example.com',
      passwordHash: 'Password123!',
    });
    await userA.save();
    tokenA = signToken(userA._id);

    userB = new User({
      name: 'David Ortiz',
      email: 'david@example.com',
      passwordHash: 'Password123!',
    });
    await userB.save();
    tokenB = signToken(userB._id);

    sampleResume = await Resume.create({
      userId: userA._id,
      originalFilename: 'maya_lin_resume.pdf',
      rawText: 'Maya Lin. Principal Engineer with 10 years experience in distributed systems and cloud platforms.',
      parsedData: {
        contact: {
          name: 'Maya Lin',
          email: 'maya@example.com',
          phone: '+1 555-0199',
        },
      },
    });

    sampleJD = await JobDescription.create({
      userId: userA._id,
      company: 'Datadog',
      roleTitle: 'Senior Distributed Systems Engineer',
      rawText: 'Datadog is looking for a Senior Distributed Systems Engineer with Go and Kafka experience.',
      requiredSkills: ['Go', 'Kubernetes', 'Kafka'],
    });

    // Created 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    sampleApp = await Application.create({
      userId: userA._id,
      runId: 'pipeline-run-followup-test-108',
      company: 'Datadog',
      roleTitle: 'Senior Distributed Systems Engineer',
      status: 'applied',
      resumeId: sampleResume._id,
      jdId: sampleJD._id,
      appliedAt: tenDaysAgo,
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

  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApp._id}/draft-followup`)
      .send({});

    expect(res.status).toBe(401);
  });

  it('should return 404 if application does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/applications/${nonExistentId}/draft-followup`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found|No application found/i);
  });

  it('should return 403 if application belongs to another user', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApp._id}/draft-followup`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permission|forbidden/i);
  });

  it('should return 400 when daysSinceApplied is negative', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApp._id}/draft-followup`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ daysSinceApplied: -5 });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
    expect(res.body.details[0].field).toBe('daysSinceApplied');
  });

  it('should draft follow-up email and update Application document using elapsed days calculation', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApp._id}/draft-followup`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipientName: 'Sarah Recruiter',
        customNotes: 'Had quick sync on LinkedIn.',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('emailDraft');

    const draft = res.body.emailDraft;
    expect(draft).toHaveProperty('subject');
    expect(draft).toHaveProperty('body');
    expect(draft.subject).toContain('Senior Distributed Systems Engineer');
    expect(draft.body).toContain('Datadog');
    expect(draft.body).toContain('Sarah Recruiter');
    expect(draft.strategy).toBe('standard_status_inquiry');
    expect(draft.daysSinceApplied).toBe(10);

    // Verify persistence in database
    const updated = await Application.findById(sampleApp._id);
    expect(updated.followUpEmail).toBeDefined();
    expect(updated.followUpEmail.subject).toBe(draft.subject);
    expect(updated.followUpDrafts.length).toBe(1);
    expect(updated.followUpDrafts[0].subject).toBe(draft.subject);
  });

  it('should support runId in the route path parameter', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApp.runId}/draft-followup`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        daysSinceApplied: 3,
        tone: 'enthusiastic and brief',
      });

    expect(res.status).toBe(200);
    expect(res.body.emailDraft.daysSinceApplied).toBe(3);
    expect(res.body.emailDraft.strategy).toBe('early_courtesy_check');

    const updated = await Application.findById(sampleApp._id);
    expect(updated.followUpDrafts.length).toBe(2);
  });

  it('should adapt strategy when status is interviewing', async () => {
    await Application.findByIdAndUpdate(sampleApp._id, { status: 'interviewing' });

    const res = await request(app)
      .post(`/api/applications/${sampleApp._id}/draft-followup`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        daysSinceApplied: 2,
        recipientName: 'Hiring Committee',
      });

    expect(res.status).toBe(200);
    expect(res.body.emailDraft.strategy).toBe('post_interview_reinforcement');
    expect(res.body.emailDraft.subject).toMatch(/thank you/i);
    expect(res.body.emailDraft.body).toContain('Hiring Committee');
  });
});
