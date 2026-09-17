const JSZip = require('jszip');
const extractTextFromDocx = require('../../src/services/parsers/docxParser');
const parseDocument = require('../../src/services/parsers/index');

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

describe('docxParser Service', () => {
  describe('extractTextFromDocx', () => {
    it('should throw an error if input is not a buffer', async () => {
      await expect(extractTextFromDocx('not a buffer')).rejects.toThrow(
        'Expected a valid Buffer containing DOCX data.'
      );
      await expect(extractTextFromDocx(null)).rejects.toThrow(
        'Expected a valid Buffer containing DOCX data.'
      );
      await expect(extractTextFromDocx(undefined)).rejects.toThrow(
        'Expected a valid Buffer containing DOCX data.'
      );
      await expect(extractTextFromDocx(12345)).rejects.toThrow(
        'Expected a valid Buffer containing DOCX data.'
      );
    });

    it('should throw an error if buffer is empty', async () => {
      await expect(extractTextFromDocx(Buffer.alloc(0))).rejects.toThrow('DOCX buffer is empty.');
    });

    it('should extract and clean text from a valid DOCX buffer', async () => {
      const sampleDocx = await createSampleDocxBuffer(
        'Sarah Connor\nCybernetics Specialist\nLocation: Los Angeles'
      );
      const text = await extractTextFromDocx(sampleDocx);
      expect(text).toContain('Sarah Connor');
      expect(text).toContain('Cybernetics Specialist');
      expect(text).toContain('Location: Los Angeles');
    });

    it('should throw a descriptive error when buffer is corrupt / not a valid DOCX zip', async () => {
      const corruptBuffer = Buffer.from('corrupt binary not docx');
      await expect(extractTextFromDocx(corruptBuffer)).rejects.toThrow(/Failed to parse DOCX:/);
    });

    it('should export cleanExtractedText and extractTextFromDocx as function properties', () => {
      expect(typeof extractTextFromDocx.cleanExtractedText).toBe('function');
      expect(typeof extractTextFromDocx.extractTextFromDocx).toBe('function');
    });
  });

  describe('parseDocument MIME Router', () => {
    const validPdfString =
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 47 >>\nstream\nBT\n/F1 18 Tf\n0 0 Td\n(PDF Routed Content) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000364 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n447\n%%EOF';

    it('should route PDF files by MIME type (application/pdf)', async () => {
      const samplePdf = Buffer.from(validPdfString);
      const text = await parseDocument(samplePdf, 'application/pdf', 'resume.pdf');
      expect(text).toContain('PDF Routed Content');
    });

    it('should route PDF files by extension fallback (.pdf)', async () => {
      const samplePdf = Buffer.from(validPdfString);
      const text = await parseDocument(samplePdf, 'application/octet-stream', 'my_cv.pdf');
      expect(text).toContain('PDF Routed Content');
    });

    it('should route DOCX files by MIME type (openxmlformats)', async () => {
      const sampleDocx = await createSampleDocxBuffer('Jane Doe\nPrincipal Architect');
      const text = await parseDocument(
        sampleDocx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'resume.docx'
      );
      expect(text).toContain('Jane Doe');
      expect(text).toContain('Principal Architect');
    });

    it('should route DOCX files by extension fallback (.docx)', async () => {
      const sampleDocx = await createSampleDocxBuffer('Jane Doe\nPrincipal Architect');
      const text = await parseDocument(sampleDocx, 'application/octet-stream', 'cv.docx');
      expect(text).toContain('Jane Doe');
    });

    it('should reject non-buffer inputs in parseDocument', async () => {
      await expect(parseDocument('string data', 'application/pdf')).rejects.toThrow(
        'Expected a valid Buffer containing document data.'
      );
    });

    it('should reject unsupported MIME types and file extensions', async () => {
      await expect(
        parseDocument(Buffer.from('hello'), 'image/png', 'photo.png')
      ).rejects.toThrow(/Unsupported document type/);

      await expect(
        parseDocument(Buffer.from('hello'), 'text/plain', 'notes.txt')
      ).rejects.toThrow(/Unsupported document type/);
    });

    it('should export expected helper properties and sub-parsers', () => {
      expect(typeof parseDocument.parseDocument).toBe('function');
      expect(typeof parseDocument.extractTextFromPdf).toBe('function');
      expect(typeof parseDocument.extractTextFromDocx).toBe('function');
      expect(typeof parseDocument.extractSections).toBe('function');
      expect(typeof parseDocument.parseJobDescription).toBe('function');
      expect(Array.isArray(parseDocument.SUPPORTED_MIME_TYPES)).toBe(true);
    });
  });
});
