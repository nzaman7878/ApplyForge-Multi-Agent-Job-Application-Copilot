const extractTextFromPdf = require('../src/services/parsers/pdfParser');
const { cleanExtractedText } = extractTextFromPdf;

async function testPdfParser() {
  console.log('🧪 Testing PDF Parser Service...\n');

  try {
    // 1. Test cleanExtractedText directly
    console.log('[Test 1] Testing cleanExtractedText helper...');
    const dirtySample =
      '\r\n\t  Alice   Smith   \r\n\n\n\n\x00Full-Stack   Developer\t\t\n\n\n\nSkills: React,   Node.js  \r\n\r\n';
    const cleanedSample = cleanExtractedText(dirtySample);
    const expectedSample = 'Alice Smith\n\nFull-Stack Developer\n\nSkills: React, Node.js';

    if (cleanedSample !== expectedSample) {
      throw new Error(
        `cleanExtractedText failed:\nExpected: ${JSON.stringify(expectedSample)}\nGot: ${JSON.stringify(cleanedSample)}`
      );
    }
    console.log(
      '✔ cleanExtractedText properly normalized whitespace, control chars, and line breaks'
    );

    // 2. Test extraction from valid PDF Buffer
    console.log('\n[Test 2] Testing extraction from valid PDF Buffer...');
    const samplePdfString =
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT\n/F1 18 Tf\n0 0 Td\n(Senior Software Engineer - Node.js) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000372 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n455\n%%EOF';

    const pdfBuffer = Buffer.from(samplePdfString);
    const extractedText = await extractTextFromPdf(pdfBuffer);

    if (!extractedText.includes('Senior Software Engineer - Node.js')) {
      throw new Error(
        `Extracted text missing expected content. Got: ${JSON.stringify(extractedText)}`
      );
    }
    console.log(`✔ Extracted text successfully: "${extractedText}"`);

    // 3. Test invalid non-buffer input
    console.log('\n[Test 3] Testing rejection of non-buffer input...');
    let nonBufferError = null;
    try {
      await extractTextFromPdf('not a buffer');
    } catch (err) {
      nonBufferError = err;
    }
    if (!nonBufferError || !nonBufferError.message.includes('Expected a valid Buffer')) {
      throw new Error('Should throw on non-buffer input');
    }
    console.log('✔ Non-buffer input correctly rejected');

    // 4. Test empty buffer input
    console.log('\n[Test 4] Testing rejection of empty buffer...');
    let emptyBufferError = null;
    try {
      await extractTextFromPdf(Buffer.alloc(0));
    } catch (err) {
      emptyBufferError = err;
    }
    if (!emptyBufferError || !emptyBufferError.message.includes('buffer is empty')) {
      throw new Error('Should throw on empty buffer input');
    }
    console.log('✔ Empty buffer correctly rejected');

    // 5. Test corrupt PDF buffer
    console.log('\n[Test 5] Testing corrupt PDF error handling...');
    let corruptPdfError = null;
    try {
      await extractTextFromPdf(Buffer.from('not really a pdf file at all'));
    } catch (err) {
      corruptPdfError = err;
    }
    if (!corruptPdfError || !corruptPdfError.message.includes('Failed to parse PDF')) {
      throw new Error('Should catch and format parsing error for corrupt buffer');
    }
    console.log('✔ Corrupt PDF buffer correctly triggered descriptive error');

    console.log('\n=============================================');
    console.log('🎉 ALL PDF PARSER TESTS PASSED');
    console.log('=============================================\n');
  } catch (error) {
    console.error('\n❌ PDF Parser Test Failed:', error);
    process.exitCode = 1;
  }
}

testPdfParser();
