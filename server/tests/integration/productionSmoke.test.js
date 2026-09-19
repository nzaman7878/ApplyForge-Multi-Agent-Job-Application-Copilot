const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../src/index');
const config = require('../../src/config/env');

function createSamplePdfBuffer(textContent = 'Sample PDF Content') {
  const streamData = `BT\n/F1 12 Tf\n10 10 Td\n(${textContent}) Tj\nET`;
  const streamLength = streamData.length;
  const samplePdfString =
    `%PDF-1.4\n` +
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n` +
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamData}\nendstream\nendobj\n` +
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` +
    `xref\n0 6\n0000000000 65535 f \n` +
    `0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000372 00000 n \n` +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n455\n%%EOF`;
  return Buffer.from(samplePdfString);
}

describe('Phase 99: Full Production Smoke Test & Environment Corrections', () => {
  let mongoServer;
  let userToken;
  let refreshToken;
  let resumeId;
  let jdId;
  let pipelineRunId;
  let applicationId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed allowed test origins including wildcard patterns
    config.corsOrigins.push('https://applyforge.vercel.app');
    config.corsOrigins.push('*.vercel.app');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Production Environment Configurations & Hardening', () => {
    it('should have Express trust proxy enabled for reverse proxies (Render / Railway / Vercel)', () => {
      expect(app.get('trust proxy')).toBe(1);
    });

    it('should return 200 OK on GET /api/health with security headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', message: 'ApplyForge API is running' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should correctly handle X-Forwarded-For headers behind reverse proxies without rate limit crash', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should allow whitelisted CORS origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://applyforge.vercel.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://applyforge.vercel.app');
    });

    it('should allow wildcard subdomain matching (e.g. *.vercel.app)', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://applyforge-preview-123.vercel.app');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://applyforge-preview-123.vercel.app');
    });

    it('should reject unauthorized origins with clean 403 JSON response', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.example.com');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS Forbidden');
    });

    it('should return clean JSON 404 for unmatched API routes', async () => {
      const res = await request(app).get('/api/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('Full End-to-End Production User Lifecycle Flow', () => {
    it('1. Register a new user in production flow', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Prod Smoke Tester',
          email: `prod_smoke_${Date.now()}@example.com`,
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      userToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('2. Retrieve user profile on GET /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toContain('prod_smoke_');
    });

    it('3. Upload resume with validated PDF magic bytes', async () => {
      const validPdfBuffer = createSamplePdfBuffer(
        'Prod Smoke Tester\\nprod@example.com\\nSenior Cloud Engineer\\nSkills: Node.js, React, Docker'
      );

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('resume', validPdfBuffer, {
          filename: 'prod_smoke_resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      resumeId = res.body.id || res.body._id;
    });

    it('4. Create a target job description on POST /api/jds', async () => {
      const res = await request(app)
        .post('/api/jds')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rawText: 'Senior Full Stack Engineer at Acme Cloud. Requirements: Node.js, React, MongoDB, Docker, CI/CD pipelines.',
          company: 'Acme Cloud',
          roleTitle: 'Senior Full Stack Engineer',
        });

      expect(res.status).toBe(201);
      jdId = res.body._id || res.body.id;
    });

    it('5. Execute multi-agent tailoring pipeline', async () => {
      const res = await request(app)
        .post('/api/pipeline/run')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          resumeId,
          jdId,
        });

      expect(res.status).toBe(201);
      expect(res.body.runId).toBeDefined();
      expect(res.body.status).toBe('awaiting_review');
      pipelineRunId = res.body.runId;
    });

    it('6. Retrieve pipeline run state on GET /api/pipeline/:runId', async () => {
      const res = await request(app)
        .get(`/api/pipeline/${pipelineRunId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe(pipelineRunId);
      expect(res.body.status).toBe('awaiting_review');
    });

    it('7. Approve pipeline run and automatically create application CRM record', async () => {
      const res = await request(app)
        .post(`/api/pipeline/${pipelineRunId}/approve`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          finalBullets: [
            {
              id: 'b1',
              optimized: 'Engineered high-throughput cloud microservices using Node.js, Docker, and MongoDB.',
              accepted: true,
            },
          ],
          finalCoverLetter: 'Dear Acme Cloud Team, I am excited to submit my application...',
        });

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe(pipelineRunId);
      expect(res.body.status).toBe('saved');
      expect(res.body.state.humanApproved).toBe(true);
      expect(res.body.applicationId).toBeDefined();
      applicationId = res.body.applicationId || res.body.application?._id;
    });

    it('8. Transition application status in CRM tracker', async () => {
      // Update status to interviewing
      const patchRes = await request(app)
        .patch(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'interviewing',
          notes: 'Technical screen passed. System design round next.',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.application.status).toBe('interviewing');
    });

    it('9. Retrieve analytics summary data on GET /api/analytics/summary', async () => {
      const res = await request(app)
        .get('/api/analytics/summary')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.total).toBeGreaterThanOrEqual(1);
    });

    it('10. Logout user and invalidate refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});
