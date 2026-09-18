const request = require('supertest');
const express = require('express');
const compression = require('compression');
const {
  responseCache,
  invalidateUserAnalyticsCache,
  clearCache,
} = require('../../src/middleware/cache');

describe('Performance Middleware: Cache & Compression', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Response Caching Middleware', () => {
    let app;
    let callCount;

    beforeEach(() => {
      callCount = 0;
      app = express();
      app.use(express.json());

      // Mock auth middleware injecting user from header
      app.use((req, res, next) => {
        if (req.headers['x-mock-user']) {
          req.user = { id: req.headers['x-mock-user'] };
        }
        next();
      });

      // 5-second cache
      app.get('/api/analytics/test', responseCache(5), (req, res) => {
        callCount++;
        res.json({ count: callCount, timestamp: Date.now() });
      });
    });

    it('returns MISS on initial request and HIT on subsequent request when cache is enabled', async () => {
      // First request (MISS)
      const res1 = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      expect(res1.headers['x-cache']).toBe('MISS');
      expect(res1.body.count).toBe(1);

      // Second request (HIT)
      const res2 = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      expect(res2.headers['x-cache']).toBe('HIT');
      expect(res2.body.count).toBe(1);
      expect(callCount).toBe(1);
    });

    it('isolates cache entries between different tenants/users', async () => {
      // Request for User 1
      const resUser1 = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      expect(resUser1.headers['x-cache']).toBe('MISS');
      expect(resUser1.body.count).toBe(1);

      // Request for User 2 should be a MISS and execute handler
      const resUser2 = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user2')
        .set('x-test-cache', 'true')
        .expect(200);

      expect(resUser2.headers['x-cache']).toBe('MISS');
      expect(resUser2.body.count).toBe(2);
      expect(callCount).toBe(2);
    });

    it('invalidates cache when invalidateUserAnalyticsCache is called', async () => {
      // Prime cache
      await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      // Invalidate
      invalidateUserAnalyticsCache('user1');

      // Next request should be MISS
      const res = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      expect(res.headers['x-cache']).toBe('MISS');
      expect(res.body.count).toBe(2);
    });

    it('bypasses cache when Cache-Control: no-cache is provided', async () => {
      // Prime cache
      await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .expect(200);

      // Request with no-cache
      const res = await request(app)
        .get('/api/analytics/test')
        .set('x-mock-user', 'user1')
        .set('x-test-cache', 'true')
        .set('Cache-Control', 'no-cache')
        .expect(200);

      expect(res.headers['x-cache']).toBe('BYPASS');
      expect(res.body.count).toBe(2);
    });
  });

  describe('Compression Middleware', () => {
    it('compresses large JSON payloads with gzip', async () => {
      const app = express();
      app.use(compression({ threshold: 50 }));
      app.get('/large-data', (req, res) => {
        const payload = { data: 'A'.repeat(5000) };
        res.json(payload);
      });

      const res = await request(app)
        .get('/large-data')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(res.headers['content-encoding']).toBe('gzip');
    });
  });
});
