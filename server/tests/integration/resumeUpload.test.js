const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const JSZip = require('jszip');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration_test_jwt_secret_applyforge';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration_test_refresh_secret_applyforge';
process.env.PORT = process.env.PORT || '5011';
process.env.NODE_ENV = 'test';

const { app } = require('../../src/index');
const User = require('../../src/models/User');
const Resume = require('../../src/models/Resume');
const { signToken } = require('../../src/utils/jwt');

/**
 * Helper to build valid DOCX buffer
 */
async function createSampleDocxBuffer(text = 'Alex Morgan\nFull Stack Engineer\nSkills: React, Node.js') {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );
  const paragraphs = text
    .split('\n')
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join('');
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Helper to build minimal valid PDF buffer
 */
function createSamplePdfBuffer(textContent) {
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

describe('Resume Upload & CRUD Endpoints Integration Tests', () => {
  let mongoServer;
  let userA;
  let tokenA;
  let userB;
  let tokenB;
  const uploadedFilesToCleanup = [];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    userA = new User({
      name: 'Alice Johnson',
      email: 'alice.resumes@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userA.save();
    tokenA = signToken(userA._id);

    userB = new User({
      name: 'Bob Smith',
      email: 'bob.resumes@applyforge.test',
      passwordHash: 'SuperHash123!',
    });
    await userB.save();
    tokenB = signToken(userB._id);
  });

  afterAll(async () => {
    for (const filePath of uploadedFilesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore cleanup error
      }
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('POST /api/resumes (Upload)', () => {
    it('should reject upload without authorization token (401)', async () => {
      const res = await request(app).post('/api/resumes').expect(401);
      expect(res.body.code).toBe('TOKEN_MISSING');
    });

    it('should reject request when no file is uploaded (400)', async () => {
      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.error).toBe('File required');
    });

    it('should reject unsupported file types (400 INVALID_FILE_TYPE)', async () => {
      const plainBuffer = Buffer.from('Plain text file content');
      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', plainBuffer, {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      expect(res.body.code).toBe('INVALID_FILE_TYPE');
    });

    let uploadedResumeId = '';

    it('should successfully upload and parse a valid PDF resume (201)', async () => {
      const pdfBuffer = createSamplePdfBuffer(
        'Alice Johnson\\nalice@example.com\\nSenior Software Engineer\\nSkills: React, Node.js'
      );

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', pdfBuffer, {
          filename: 'alice_resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      uploadedResumeId = res.body.id || res.body._id;
      expect(res.body.originalFilename).toBe('alice_resume.pdf');
      expect(res.body.rawText).toBeDefined();
      expect(res.body.parsedSections).toBeDefined();

      if (res.body.filePath) {
        uploadedFilesToCleanup.push(res.body.filePath);
      }

      // Verify stored in MongoDB
      const stored = await Resume.findById(uploadedResumeId);
      expect(stored).not.toBeNull();
      expect(stored.userId.toString()).toBe(userA._id.toString());
      expect(stored.originalFilename).toBe('alice_resume.pdf');
    });

    it('should successfully upload and parse a valid DOCX resume with field name "file" (201)', async () => {
      const docxText =
        'Alice Johnson\nalice@example.com\n\nEXPERIENCE\nSenior Engineer at TechCorp\n2021 - Present\n• Built microservices\n\nSKILLS\nJavaScript, Node.js, MongoDB';
      const docxBuffer = await createSampleDocxBuffer(docxText);

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', docxBuffer, {
          filename: 'alice_cv.docx',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        .expect(201);

      expect(res.body.originalFilename).toBe('alice_cv.docx');
      expect(res.body.parsedSections.contact.email).toBe('alice@example.com');
      expect(res.body.parsedSections.skills).toEqual(
        expect.arrayContaining(['JavaScript', 'Node.js', 'MongoDB'])
      );

      if (res.body.filePath) {
        uploadedFilesToCleanup.push(res.body.filePath);
      }
    });

    it('should list all resumes belonging to authenticated user on GET /api/resumes', async () => {
      const res = await request(app)
        .get('/api/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const resumes = res.body.resumes || res.body;
      expect(Array.isArray(resumes)).toBe(true);
      expect(resumes.length).toBe(2);

      // Verify user B sees 0 resumes (tenant isolation)
      const userBRes = await request(app)
        .get('/api/resumes')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const userBResumes = userBRes.body.resumes || userBRes.body;
      expect(Array.isArray(userBResumes)).toBe(true);
      expect(userBResumes.length).toBe(0);
    });

    it('should retrieve single resume detail on GET /api/resumes/:id', async () => {
      const res = await request(app)
        .get(`/api/resumes/${uploadedResumeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const resumeData = res.body.resume || res.body;
      expect(resumeData.originalFilename).toBe('alice_resume.pdf');
    });

    it('should prevent User B from accessing User A resume (403 or 404)', async () => {
      const res = await request(app)
        .get(`/api/resumes/${uploadedResumeId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
    });

    it('should delete resume on DELETE /api/resumes/:id', async () => {
      await request(app)
        .delete(`/api/resumes/${uploadedResumeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const check = await Resume.findById(uploadedResumeId);
      expect(check).toBeNull();
    });
  });
});
