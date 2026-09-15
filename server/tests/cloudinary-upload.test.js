const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5030';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const { signToken } = require('../src/utils/jwt');
const cloudinaryService = require('../src/services/cloudinary');

async function createSampleDocxBuffer(text = 'Alex Rivera\nSenior Engineer\nSkills: Node.js, React') {
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
  const paragraphs = text.split('\n').map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('Multer & Cloudinary Resume Upload Integration', async (t) => {
  let mongoServer;
  let testUser;
  let authToken;

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    testUser = await User.create({
      name: 'Cloudinary Tester',
      email: 'cloudinary.tester@example.com',
      passwordHash: 'Password123!',
    });

    authToken = signToken(testUser._id);
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('1. Cloudinary service module exports expected methods', () => {
    assert.strictEqual(typeof cloudinaryService.isConfigured, 'function');
    assert.strictEqual(typeof cloudinaryService.uploadResumeFile, 'function');
    assert.strictEqual(typeof cloudinaryService.deleteResumeFile, 'function');
    assert.ok(cloudinaryService.cloudinary);
  });

  await t.test('2. Resume schema includes cloudinaryUrl and cloudinaryPublicId fields', async () => {
    const testResume = new Resume({
      userId: testUser._id,
      originalFilename: 'schema_test.pdf',
      rawText: 'Sample text',
      cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/v1234/sample.pdf',
      cloudinaryPublicId: 'applyforge/resumes/1234_sample',
    });

    await testResume.save();
    const found = await Resume.findById(testResume._id);

    assert.strictEqual(found.cloudinaryUrl, 'https://res.cloudinary.com/demo/raw/upload/v1234/sample.pdf');
    assert.strictEqual(found.cloudinaryPublicId, 'applyforge/resumes/1234_sample');

    const json = found.toJSON();
    assert.strictEqual(json.cloudinaryUrl, 'https://res.cloudinary.com/demo/raw/upload/v1234/sample.pdf');
    assert.strictEqual(json.cloudinaryPublicId, 'applyforge/resumes/1234_sample');

    await Resume.deleteOne({ _id: testResume._id });
  });

  await t.test('3. Upload resume with Cloudinary service enabled persists Cloudinary metadata', async () => {
    const originalIsConfigured = cloudinaryService.isConfigured;
    const originalUpload = cloudinaryService.uploadResumeFile;

    const mockCloudinaryUrl = 'https://res.cloudinary.com/demo/raw/upload/v1700000000/applyforge/resumes/test_resume.docx';
    const mockPublicId = 'applyforge/resumes/mock_public_id_123';

    cloudinaryService.isConfigured = () => true;
    cloudinaryService.uploadResumeFile = async (filePathOrBuffer) => {
      assert.ok(filePathOrBuffer);
      return {
        url: mockCloudinaryUrl,
        secureUrl: mockCloudinaryUrl,
        publicId: mockPublicId,
        format: 'docx',
        bytes: 1024,
      };
    };

    try {
      const docxBuffer = await createSampleDocxBuffer('Jane Doe\nStaff Engineer\nSkills: Python, TypeScript');

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', docxBuffer, 'jane_doe_resume.docx')
        .expect(201);

      assert.strictEqual(res.body.originalFilename, 'jane_doe_resume.docx');
      assert.strictEqual(res.body.cloudinaryUrl, mockCloudinaryUrl);
      assert.strictEqual(res.body.cloudinaryPublicId, mockPublicId);

      // Verify stored in MongoDB
      const savedDoc = await Resume.findById(res.body.id || res.body._id);
      assert.ok(savedDoc);
      assert.strictEqual(savedDoc.cloudinaryUrl, mockCloudinaryUrl);
      assert.strictEqual(savedDoc.cloudinaryPublicId, mockPublicId);

      // Clean up local file created by Multer if any
      if (savedDoc.filePath && fs.existsSync(savedDoc.filePath)) {
        fs.unlinkSync(savedDoc.filePath);
      }
    } finally {
      cloudinaryService.isConfigured = originalIsConfigured;
      cloudinaryService.uploadResumeFile = originalUpload;
    }
  });

  await t.test('4. Upload resume without Cloudinary configured gracefully falls back to local storage', async () => {
    const originalIsConfigured = cloudinaryService.isConfigured;
    cloudinaryService.isConfigured = () => false;

    try {
      const docxBuffer = await createSampleDocxBuffer('Bob Smith\nFrontend Developer\nSkills: React, Tailwind');

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('resume', docxBuffer, 'bob_smith.docx')
        .expect(201);

      assert.strictEqual(res.body.originalFilename, 'bob_smith.docx');
      assert.strictEqual(res.body.cloudinaryUrl, '');
      assert.strictEqual(res.body.cloudinaryPublicId, '');

      const savedDoc = await Resume.findById(res.body.id || res.body._id);
      assert.ok(savedDoc);
      assert.strictEqual(savedDoc.cloudinaryUrl, '');

      if (savedDoc.filePath && fs.existsSync(savedDoc.filePath)) {
        fs.unlinkSync(savedDoc.filePath);
      }
    } finally {
      cloudinaryService.isConfigured = originalIsConfigured;
    }
  });

  await t.test('5. Deleting resume triggers Cloudinary cleanup when publicId is present', async () => {
    const originalIsConfigured = cloudinaryService.isConfigured;
    const originalDelete = cloudinaryService.deleteResumeFile;

    let deletedPublicId = null;
    cloudinaryService.isConfigured = () => true;
    cloudinaryService.deleteResumeFile = async (publicId) => {
      deletedPublicId = publicId;
      return { result: 'ok' };
    };

    try {
      const resumeToDelete = await Resume.create({
        userId: testUser._id,
        originalFilename: 'to_delete.pdf',
        rawText: 'Dummy content',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/v1234/to_delete.pdf',
        cloudinaryPublicId: 'applyforge/resumes/to_delete_999',
      });

      const res = await request(app)
        .delete(`/api/resumes/${resumeToDelete._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      assert.strictEqual(res.body.message, 'Resume deleted successfully');
      assert.strictEqual(deletedPublicId, 'applyforge/resumes/to_delete_999');

      const checkDb = await Resume.findById(resumeToDelete._id);
      assert.strictEqual(checkDb, null);
    } finally {
      cloudinaryService.isConfigured = originalIsConfigured;
      cloudinaryService.deleteResumeFile = originalDelete;
    }
  });
});
