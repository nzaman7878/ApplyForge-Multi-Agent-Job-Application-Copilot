const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5010';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');

describe('Auth Endpoints Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  const testUser = {
    name: 'Integration Tester',
    email: 'integration.auth@applyforge.test',
    password: 'SecurePassword123!',
  };

  let accessToken = '';
  let refreshToken = '';

  describe('POST /api/auth/register', () => {
    it('should reject registration with missing required fields', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'test@only.com' });
      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
    });

    it('should register a new user and return tokens and safe user object', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');

      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);

      // Verify password hash and refresh tokens are not leaked
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.refreshToken).toBeUndefined();

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject duplicate registration with the same email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      expect(res.status).toBe(409);
      expect(res.body.message || res.body.error).toMatch(/already registered|duplicate|exists/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword999!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid login credentials');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@applyforge.test', password: testUser.password });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid login credentials');
    });

    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject request without authorization header', async () => {
      const res = await request(app).get('/api/auth/me').expect(401);
      expect(res.body.code).toBe('TOKEN_MISSING');
    });

    it('should reject request with invalid/tampered token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload')
        .expect(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('should return authenticated user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body.name).toBe(testUser.name);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should reject refresh without refreshToken', async () => {
      const res = await request(app).post('/api/auth/refresh').send({}).expect(400);
      expect(res.body.error).toBe('Refresh token is required');
    });

    it('should issue a new accessToken with valid refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      const newAccessToken = res.body.accessToken;
      expect(typeof newAccessToken).toBe('string');

      // Verify new token works on protected route
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);
      expect(meRes.body.email).toBe(testUser.email);

      accessToken = newAccessToken;
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should log out user and invalidate refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.message).toContain('Logged out');

      // Subsequent refresh with revoked token should fail (401)
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      expect(reuseRes.body.code).toBe('REFRESH_TOKEN_INVALID');
    });
  });
});
