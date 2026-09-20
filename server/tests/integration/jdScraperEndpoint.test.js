const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5016';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const JobDescription = require('../../src/models/JobDescription');
const { signToken } = require('../../src/utils/jwt');

jest.mock('axios');

describe('JD Scraper Ingestion Endpoint (POST /api/jds/from-url) Integration Tests', () => {
  let mongoServer;
  let user;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    user = new User({
      name: 'JD Scraper Tester',
      email: 'scraper.test@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await user.save();
    token = signToken(user._id);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Input Validation', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/jds/from-url')
        .send({ url: 'https://boards.greenhouse.io/stripe/jobs/12345' })
        .expect(401);

      expect(res.body.code).toBe('TOKEN_MISSING');
    });

    it('should reject missing url with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.some((d) => d.field === 'url')).toBe(true);
    });

    it('should reject invalid non-http URL with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'ftp://not-a-valid-http-url' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.some((d) => d.field === 'url')).toBe(true);
    });
  });

  describe('Successful Scraper Ingestion and Persistence', () => {
    it('should scrape a greenhouse job posting and persist JobDescription document (201)', async () => {
      const mockGreenhouseHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Backend Engineer - Stripe</title></head>
          <body>
            <div id="wrapper">
              <h1 class="app-title">Staff Platform Engineer</h1>
              <span class="company-name">Stripe</span>
              <div class="location">Remote - US</div>
              <div id="content">
                <p>We are looking for a Staff Platform Engineer to lead core ledger systems.</p>
                <h3>Requirements:</h3>
                <ul>
                  <li>7+ years experience with distributed systems and microservices.</li>
                  <li>Proficiency in Go, Java, or Ruby.</li>
                  <li>Deep knowledge of PostgreSQL, Kafka, and Kubernetes.</li>
                </ul>
              </div>
            </div>
          </body>
        </html>
      `;

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockGreenhouseHtml,
      });

      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://boards.greenhouse.io/stripe/jobs/998877' })
        .expect(201);

      expect(res.body.company).toBe('Stripe');
      expect(res.body.roleTitle).toBe('Staff Platform Engineer');
      expect(res.body.source).toBe('url');
      expect(res.body.sourceUrl).toBe('https://boards.greenhouse.io/stripe/jobs/998877');
      expect(res.body.rawText).toContain('Staff Platform Engineer');
      expect(res.body.rawText).toContain('distributed systems and microservices');
      expect(res.body.parsedRequirements).toBeDefined();
      expect(res.body.metadata.board).toBe('greenhouse');

      // Verify MongoDB persistence
      const savedJd = await JobDescription.findById(res.body.id);
      expect(savedJd).not.toBeNull();
      expect(savedJd.userId.toString()).toBe(user._id.toString());
      expect(savedJd.source).toBe('url');
      expect(savedJd.sourceUrl).toBe('https://boards.greenhouse.io/stripe/jobs/998877');
    });

    it('should respect user-supplied company and roleTitle overrides (201)', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Software Engineer</title></head>
          <body>
            <main>
              <p>Generic job posting content with required skills: React, TypeScript, GraphQL, Node.js.</p>
            </main>
          </body>
        </html>
      `;

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      });

      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://careers.acme.com/jobs/dev-1',
          company: 'Acme Global Corp',
          roleTitle: 'Principal Frontend Architect',
        })
        .expect(201);

      expect(res.body.company).toBe('Acme Global Corp');
      expect(res.body.roleTitle).toBe('Principal Frontend Architect');
      expect(res.body.source).toBe('url');
    });

    it('should return extracted details in preview mode without creating a document in database (200)', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Cloud Platform Engineer - Netflix</title></head>
          <body>
            <main>
              <h1>Senior Cloud Platform Engineer</h1>
              <p>Netflix is hiring for streaming platform resilience.</p>
              <p>Key skills required: Go, AWS, Chaos Engineering, Spinnaker, Kubernetes.</p>
            </main>
          </body>
        </html>
      `;

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      });

      const initialCount = await JobDescription.countDocuments({ userId: user._id });

      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://jobs.netflix.com/jobs/98765',
          company: 'Netflix, Inc.',
          preview: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.preview).toBe(true);
      expect(res.body.company).toBe('Netflix, Inc.');
      expect(res.body.roleTitle).toBe('Senior Cloud Platform Engineer');
      expect(res.body.rawText).toContain('streaming platform resilience');
      expect(res.body.rawText).toContain('Chaos Engineering');

      // Ensure no new MongoDB document was created
      const finalCount = await JobDescription.countDocuments({ userId: user._id });
      expect(finalCount).toBe(initialCount);
    });

    it('should handle remote scraper failures gracefully with 422', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND invalid-job-site-999.org');
      axios.get.mockRejectedValueOnce(networkError);

      const res = await request(app)
        .post('/api/jds/from-url')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://invalid-job-site-999.org/jobs/404' })
        .expect(422);

      expect(res.body.error).toBe('Scrape error');
      expect(res.body.message).toContain('Failed to scrape job description');
    });
  });
});
