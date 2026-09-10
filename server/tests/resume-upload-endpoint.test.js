const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Set dummy JWT secret and env vars before loading app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_applyforge_123';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_applyforge_123';
process.env.PORT = process.env.PORT || '5002';
process.env.NODE_ENV = 'test';

const { app } = require('../src/index');
const User = require('../src/models/User');
const Resume = require('../src/models/Resume');
const { signToken } = require('../src/utils/jwt');

/**
 * Creates a minimal valid DOCX binary buffer in memory
 */
async function createSampleDocxBuffer(
  text = 'Alex Morgan\nFull Stack Engineer\nSkills: React, Node.js'
) {
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
 * Creates a minimal valid PDF binary buffer in memory
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

async function testResumeUploadEndpoint() {
  console.log('🧪 Testing POST /api/resumes Upload Endpoint...\n');

  let mongoServer;
  const filesToCleanup = [];

  try {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✔ Connected to in-memory MongoDB');

    // 2. Create test user and token
    const testUser = new User({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      passwordHash: 'SuperSecret123!',
    });
    await testUser.save();
    const token = signToken(testUser._id);
    console.log(`✔ Created test user: ${testUser.email} (ID: ${testUser._id})`);

    // 3. Test 401 when Authorization header is missing
    console.log('\n[Test 1] POST /api/resumes without auth token (expect 401)...');
    const noAuthRes = await request(app).post('/api/resumes').expect(401);

    if (noAuthRes.body.code !== 'TOKEN_MISSING') {
      throw new Error(`Expected TOKEN_MISSING code, got: ${JSON.stringify(noAuthRes.body)}`);
    }
    console.log('✔ Correctly rejected unauthorized request (401 TOKEN_MISSING)');

    // 4. Test 400 when no file is uploaded
    console.log('\n[Test 2] POST /api/resumes with auth but no file (expect 400)...');
    const noFileRes = await request(app)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    if (noFileRes.body.error !== 'File required') {
      throw new Error(`Expected File required error, got: ${JSON.stringify(noFileRes.body)}`);
    }
    console.log('✔ Correctly rejected request without file (400 File required)');

    // 5. Test 400 when invalid file type is uploaded
    console.log('\n[Test 3] POST /api/resumes with invalid file type (expect 400)...');
    const textBuffer = Buffer.from('Plain text content');
    const invalidTypeRes = await request(app)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', textBuffer, {
        filename: 'resume.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    if (invalidTypeRes.body.code !== 'INVALID_FILE_TYPE') {
      throw new Error(
        `Expected INVALID_FILE_TYPE error, got: ${JSON.stringify(invalidTypeRes.body)}`
      );
    }
    console.log('✔ Correctly rejected invalid file type (400 INVALID_FILE_TYPE)');

    // 6. Test valid PDF upload using field name 'resume'
    console.log('\n[Test 4] POST /api/resumes with valid PDF and field "resume" (expect 201)...');
    const pdfBuffer = createSamplePdfBuffer(
      'Jane Doe\\njane.doe@example.com\\nSenior Software Engineer\\nSkills: JavaScript, Node.js, React'
    );

    const pdfRes = await request(app)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', pdfBuffer, {
        filename: 'jane_resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const pdfResume = pdfRes.body;
    if (!pdfResume.id && !pdfResume._id) {
      throw new Error(`Expected resume id in response, got: ${JSON.stringify(pdfResume)}`);
    }
    if (pdfResume.originalFilename !== 'jane_resume.pdf') {
      throw new Error(
        `Expected originalFilename jane_resume.pdf, got: ${pdfResume.originalFilename}`
      );
    }
    if (!pdfResume.rawText || !pdfResume.parsedSections) {
      throw new Error('Expected rawText and parsedSections in response');
    }
    if (pdfResume.filePath) {
      filesToCleanup.push(pdfResume.filePath);
    }

    // Verify stored in MongoDB
    const storedPdfResume = await Resume.findById(pdfResume.id || pdfResume._id);
    if (!storedPdfResume) {
      throw new Error('Resume not found in MongoDB after 201 response');
    }
    if (storedPdfResume.userId.toString() !== testUser._id.toString()) {
      throw new Error('Stored resume userId does not match authenticated user');
    }
    console.log(`✔ PDF resume uploaded and saved with ID: ${storedPdfResume._id}`);
    console.log(
      `✔ Parsed sections: contact email = "${storedPdfResume.parsedSections?.contact?.email || 'parsed'}"`
    );

    // 7. Test valid DOCX upload using field name 'file'
    console.log('\n[Test 5] POST /api/resumes with valid DOCX and field "file" (expect 201)...');
    const docxContent =
      'Jane Doe\n' +
      'jane.doe@example.com | (555) 019-2834\n\n' +
      'SUMMARY\n' +
      'Lead Full-Stack Engineer with 8 years of enterprise application design.\n\n' +
      'EXPERIENCE\n' +
      'Senior Engineer at CloudCorp\n' +
      'Jan 2021 - Present\n' +
      '- Architected resilient microservices handling 2M requests/sec.\n\n' +
      'EDUCATION\n' +
      'BS in Computer Science\n' +
      'Tech University, 2016 - 2020\n\n' +
      'SKILLS\n' +
      'JavaScript, TypeScript, Node.js, Express, React, MongoDB, Docker';

    const docxBuffer = await createSampleDocxBuffer(docxContent);
    const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const docxRes = await request(app)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', docxBuffer, {
        filename: 'jane_experience.docx',
        contentType: docxMime,
      })
      .expect(201);

    const docxResume = docxRes.body;
    if (docxResume.originalFilename !== 'jane_experience.docx') {
      throw new Error(
        `Expected originalFilename jane_experience.docx, got: ${docxResume.originalFilename}`
      );
    }
    if (docxResume.filePath) {
      filesToCleanup.push(docxResume.filePath);
    }

    const storedDocxResume = await Resume.findById(docxResume.id || docxResume._id);
    if (!storedDocxResume) {
      throw new Error('DOCX resume was not stored in MongoDB');
    }

    const sections = storedDocxResume.parsedSections;
    if (!sections.contact || !sections.contact.email) {
      throw new Error(`Expected parsed contact email, got: ${JSON.stringify(sections.contact)}`);
    }
    if (!sections.skills || sections.skills.length === 0) {
      throw new Error(`Expected parsed skills, got: ${JSON.stringify(sections.skills)}`);
    }
    if (!sections.experience || sections.experience.length === 0) {
      throw new Error(`Expected parsed experience, got: ${JSON.stringify(sections.experience)}`);
    }

    console.log(`✔ DOCX resume uploaded and saved with ID: ${storedDocxResume._id}`);
    console.log(
      `✔ Extracted ${sections.skills.length} skills and ${sections.experience.length} experience entries`
    );

    console.log('\n=============================================');
    console.log('🎉 ALL RESUME UPLOAD ENDPOINT TESTS PASSED');
    console.log('=============================================\n');
  } finally {
    // Clean up uploaded disk files
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // ignore cleanup errors
      }
    }

    // Disconnect and stop mongo memory server
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

testResumeUploadEndpoint()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
