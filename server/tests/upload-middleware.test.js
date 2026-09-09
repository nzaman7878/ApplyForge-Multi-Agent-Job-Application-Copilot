const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const upload = require('../src/middleware/upload');

async function testUploadMiddleware() {
  console.log('🧪 Testing Multer Upload Middleware...\n');

  // Setup express test app
  const app = express();
  app.post('/test/upload', upload.handleUpload('resume'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    return res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      },
    });
  });

  const createdFiles = [];

  try {
    // 1. Test PDF Upload
    console.log('[Test 1] Testing valid PDF file upload...');
    const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for testing');
    const pdfRes = await request(app)
      .post('/test/upload')
      .attach('resume', pdfBuffer, {
        filename: 'my_resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    if (!pdfRes.body.file || pdfRes.body.file.mimetype !== 'application/pdf') {
      throw new Error('PDF upload failed to register correct mimetype');
    }
    createdFiles.push(pdfRes.body.file.path);
    console.log(`✔ PDF uploaded successfully: ${pdfRes.body.file.filename}`);

    // 2. Test DOCX Upload
    console.log('\n[Test 2] Testing valid DOCX file upload...');
    const docxBuffer = Buffer.from('PK\x03\x04 mock docx binary data');
    const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const docxRes = await request(app)
      .post('/test/upload')
      .attach('resume', docxBuffer, {
        filename: 'resume_v2.docx',
        contentType: docxMime,
      })
      .expect(200);

    if (!docxRes.body.file || docxRes.body.file.mimetype !== docxMime) {
      throw new Error('DOCX upload failed to register correct mimetype');
    }
    createdFiles.push(docxRes.body.file.path);
    console.log(`✔ DOCX uploaded successfully: ${docxRes.body.file.filename}`);

    // 3. Test Invalid File Type (e.g. .txt / text/plain)
    console.log('\n[Test 3] Testing invalid file type rejection (.txt)...');
    const txtBuffer = Buffer.from('Plain text resume content');
    const txtRes = await request(app)
      .post('/test/upload')
      .attach('resume', txtBuffer, {
        filename: 'resume.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    if (!txtRes.body.error || !txtRes.body.message.includes('PDF and DOCX')) {
      throw new Error(`Expected invalid file type error, got: ${JSON.stringify(txtRes.body)}`);
    }
    console.log('✔ Invalid file type properly rejected with HTTP 400');

    // 4. Test Invalid Extension with fake PDF MIME
    console.log(
      '\n[Test 4] Testing mismatched extension with PDF MIME (e.g., script.js with application/pdf)...'
    );
    const fakeRes = await request(app)
      .post('/test/upload')
      .attach('resume', Buffer.from('alert(1)'), {
        filename: 'malicious.js',
        contentType: 'application/pdf',
      })
      .expect(400);

    if (!fakeRes.body.error) {
      throw new Error('Mismatched extension should be rejected');
    }
    console.log('✔ Non-PDF extension properly rejected');

    // 5. Test File Exceeding 5MB Limit
    console.log('\n[Test 5] Testing file size limit (> 5MB)...');
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB
    const largeRes = await request(app)
      .post('/test/upload')
      .attach('resume', largeBuffer, {
        filename: 'huge_portfolio.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    if (!largeRes.body.code || largeRes.body.code !== 'LIMIT_FILE_SIZE') {
      throw new Error(`Expected LIMIT_FILE_SIZE error, got: ${JSON.stringify(largeRes.body)}`);
    }
    console.log('✔ File exceeding 5MB rejected with LIMIT_FILE_SIZE and HTTP 400');

    console.log('\n=============================================');
    console.log('🎉 ALL MULTER UPLOAD TESTS PASSED');
    console.log('=============================================\n');
  } catch (err) {
    console.error('\n❌ Upload Middleware Test Failed:', err);
    process.exitCode = 1;
  } finally {
    // Clean up test uploaded files
    for (const filePath of createdFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  }
}

testUploadMiddleware();
