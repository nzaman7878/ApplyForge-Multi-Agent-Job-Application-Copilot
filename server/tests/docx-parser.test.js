const JSZip = require('jszip');
const extractTextFromDocx = require('../src/services/parsers/docxParser');
const parseDocument = require('../src/services/parsers/index');

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

async function testDocxParser() {
  console.log('🧪 Testing DOCX Parser & MIME Router Service...\n');

  try {
    // 1. Direct DOCX extraction test
    console.log('[Test 1] Testing direct extractTextFromDocx extraction...');
    const sampleDocx = await createSampleDocxBuffer(
      'Sarah Connor\nCybernetics Specialist\nLocation: Los Angeles'
    );
    const docxText = await extractTextFromDocx(sampleDocx);

    if (!docxText.includes('Sarah Connor') || !docxText.includes('Cybernetics Specialist')) {
      throw new Error(`DOCX text extraction missing content. Got: ${JSON.stringify(docxText)}`);
    }
    console.log(`✔ Extracted DOCX text successfully:\n"${docxText}"`);

    // 2. MIME Router: DOCX Routing
    console.log('\n[Test 2] Testing parseDocument router with DOCX MIME type...');
    const routedDocx = await parseDocument(
      sampleDocx,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'resume.docx'
    );
    if (!routedDocx.includes('Sarah Connor')) {
      throw new Error('parseDocument failed to route DOCX correctly');
    }
    console.log('✔ parseDocument successfully routed DOCX document');

    // 3. MIME Router: PDF Routing
    console.log('\n[Test 3] Testing parseDocument router with PDF MIME type...');
    const samplePdfString =
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 47 >>\nstream\nBT\n/F1 18 Tf\n0 0 Td\n(PDF Routed Content) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000364 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n447\n%%EOF';
    const samplePdf = Buffer.from(samplePdfString);
    const routedPdf = await parseDocument(samplePdf, 'application/pdf', 'my_cv.pdf');

    if (!routedPdf.includes('PDF Routed Content')) {
      throw new Error(
        `parseDocument failed to route PDF correctly. Got: ${JSON.stringify(routedPdf)}`
      );
    }
    console.log('✔ parseDocument successfully routed PDF document');

    // 4. MIME Router: Fallback by filename extension
    console.log('\n[Test 4] Testing fallback routing by file extension (.docx)...');
    const extRouted = await parseDocument(sampleDocx, 'application/octet-stream', 'resume.docx');
    if (!extRouted.includes('Sarah Connor')) {
      throw new Error('parseDocument failed extension fallback');
    }
    console.log('✔ parseDocument successfully routed via filename extension fallback');

    // 5. Unsupported Document Type Error
    console.log('\n[Test 5] Testing rejection of unsupported MIME type...');
    let unsupportedError = null;
    try {
      await parseDocument(Buffer.from('hello'), 'image/png', 'picture.png');
    } catch (err) {
      unsupportedError = err;
    }
    if (!unsupportedError || !unsupportedError.message.includes('Unsupported document type')) {
      throw new Error('Should throw descriptive error for unsupported document type');
    }
    console.log('✔ Unsupported MIME type correctly rejected');

    // 6. Invalid buffer input error
    console.log('\n[Test 6] Testing input validation (non-buffer and empty buffer)...');
    let nonBufferError = null;
    try {
      await extractTextFromDocx('not a buffer');
    } catch (err) {
      nonBufferError = err;
    }
    if (!nonBufferError || !nonBufferError.message.includes('Expected a valid Buffer')) {
      throw new Error('Should throw on non-buffer input');
    }

    let emptyBufferError = null;
    try {
      await extractTextFromDocx(Buffer.alloc(0));
    } catch (err) {
      emptyBufferError = err;
    }
    if (!emptyBufferError || !emptyBufferError.message.includes('buffer is empty')) {
      throw new Error('Should throw on empty buffer input');
    }
    console.log('✔ Non-buffer and empty buffer correctly rejected');

    console.log('\n=============================================');
    console.log('🎉 ALL DOCX PARSER & MIME ROUTER TESTS PASSED');
    console.log('=============================================\n');
  } catch (error) {
    console.error('\n❌ DOCX Parser Test Failed:', error);
    process.exitCode = 1;
  }
}

testDocxParser();
