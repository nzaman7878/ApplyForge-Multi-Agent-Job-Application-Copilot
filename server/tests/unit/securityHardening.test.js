const request = require('supertest');
const express = require('express');
const { app } = require('../../src/index');
const {
  validateFileMagicBytes,
  isPdfBuffer,
  isDocxBuffer,
  isExecutableOrScript,
} = require('../../src/utils/magicBytes');
const { apiLimiter } = require('../../src/middleware/rateLimiter');
const JSZip = require('jszip');

describe('Security Hardening Test Suite (Phase 96)', () => {
  describe('Content Security Policy (CSP) Headers via Helmet', () => {
    it('should include Content-Security-Policy header with expected directives', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers).toHaveProperty('content-security-policy');
      const csp = res.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
      expect(csp).toContain('https://fonts.gstatic.com');
      expect(csp).toContain('https://res.cloudinary.com');
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
    });

    it('should include X-Content-Type-Options: nosniff header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS Origin Whitelist Enforcement', () => {
    it('should allow requests from whitelisted origins (e.g. localhost:5173)', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests with no Origin header (e.g. server-to-server, curl, Postman)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });

    it('should reject requests from unauthorized third-party origins', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://unauthorized-domain.com');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'CORS Forbidden');
      expect(res.body.message).toContain('not allowed by CORS whitelist');
    });
  });

  describe('API Rate Limiting', () => {
    let rateLimitedApp;

    beforeAll(() => {
      rateLimitedApp = express();
      rateLimitedApp.use(apiLimiter);
      rateLimitedApp.get('/test-endpoint', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within rate limits and return rate limit headers when enabled', async () => {
      const res = await request(rateLimitedApp)
        .get('/test-endpoint')
        .set('x-test-rate-limit', 'true');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('ratelimit');
      expect(res.headers['ratelimit']).toContain('limit=100');
      expect(res.headers['ratelimit']).toContain('remaining=99');
    });

    it('should reject requests with 429 when rate limit threshold is exceeded', async () => {
      const rateLimit = require('express-rate-limit');
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 3,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: {
          error: 'Too many requests',
          message: 'Too many requests from this IP, please try again after 15 minutes',
        },
      });

      const strictApp = express();
      strictApp.use(testLimiter);
      strictApp.get('/api/test', (req, res) => res.json({ ok: true }));

      // 3 successful calls
      await request(strictApp).get('/api/test').expect(200);
      await request(strictApp).get('/api/test').expect(200);
      await request(strictApp).get('/api/test').expect(200);

      // 4th call should trigger 429 Too Many Requests
      const res = await request(strictApp).get('/api/test').expect(429);
      expect(res.body).toHaveProperty('error', 'Too many requests');
    });
  });

  describe('File Upload Sanitization: Magic Bytes Inspection', () => {
    it('should accept valid PDF buffers starting with %PDF-', () => {
      const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
      expect(isPdfBuffer(validPdf)).toBe(true);

      const validation = validateFileMagicBytes(validPdf, 'application/pdf');
      expect(validation.isValid).toBe(true);
      expect(validation.detectedType).toBe('pdf');
    });

    it('should accept valid DOCX / OpenXML ZIP buffers starting with PK\\x03\\x04', async () => {
      const zip = new JSZip();
      zip.file('word/document.xml', '<w:document></w:document>');
      const validDocx = await zip.generateAsync({ type: 'nodebuffer' });

      expect(isDocxBuffer(validDocx)).toBe(true);

      const validation = validateFileMagicBytes(
        validDocx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(validation.isValid).toBe(true);
      expect(validation.detectedType).toBe('docx');
    });

    it('should reject spoofed PDF files containing plain text', () => {
      const spoofedPdf = Buffer.from('This is a plain text file pretending to be a resume.pdf');
      expect(isPdfBuffer(spoofedPdf)).toBe(false);

      const validation = validateFileMagicBytes(spoofedPdf, 'application/pdf');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('should reject spoofed DOCX files containing arbitrary text', () => {
      const spoofedDocx = Buffer.from('Plain text fake resume content');
      expect(isDocxBuffer(spoofedDocx)).toBe(false);

      const validation = validateFileMagicBytes(spoofedDocx, 'resume.docx');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('INVALID_FILE_SIGNATURE');
    });

    it('should reject binary executable headers (MZ signature)', () => {
      const fakePdfExe = Buffer.from([0x4d, 0x5a, 0x00, 0x00, 0x00, 0x00]);
      expect(isExecutableOrScript(fakePdfExe)).toBe(true);

      const validation = validateFileMagicBytes(fakePdfExe, 'application/pdf');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('PROHIBITED_FILE_SIGNATURE');
      expect(validation.reason).toContain('Prohibited binary executable');
    });

    it('should reject Linux ELF binary header', () => {
      const fakeElf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01]);
      expect(isExecutableOrScript(fakeElf)).toBe(true);

      const validation = validateFileMagicBytes(fakeElf, 'application/pdf');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('PROHIBITED_FILE_SIGNATURE');
    });

    it('should reject script payloads (e.g. script injection)', () => {
      const scriptPayload = Buffer.from('<script>console.log("embedded payload")</script>');
      expect(isExecutableOrScript(scriptPayload)).toBe(true);

      const validation = validateFileMagicBytes(scriptPayload, 'resume.pdf');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('PROHIBITED_FILE_SIGNATURE');
    });

    it('should reject empty buffers', () => {
      const emptyBuffer = Buffer.alloc(0);
      const validation = validateFileMagicBytes(emptyBuffer, 'resume.pdf');
      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('EMPTY_FILE');
    });
  });
});
