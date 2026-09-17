const extractTextFromPdf = require('../../src/services/parsers/pdfParser');
const { cleanExtractedText } = extractTextFromPdf;

describe('pdfParser Service', () => {
  describe('cleanExtractedText', () => {
    it('should return an empty string for null, undefined, or non-string inputs', () => {
      expect(cleanExtractedText(null)).toBe('');
      expect(cleanExtractedText(undefined)).toBe('');
      expect(cleanExtractedText('')).toBe('');
      expect(cleanExtractedText(12345)).toBe('');
      expect(cleanExtractedText({})).toBe('');
    });

    it('should normalize CRLF and CR line endings to LF', () => {
      const input = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      const result = cleanExtractedText(input);
      expect(result).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('should strip null bytes and non-printable control characters', () => {
      const input = 'Hello\x00 World\x07!\x1F How are you?';
      const result = cleanExtractedText(input);
      expect(result).toBe('Hello World! How are you?');
    });

    it('should collapse multiple horizontal spaces and tabs into a single space', () => {
      const input = 'Senior   Software   \t   Engineer    ';
      const result = cleanExtractedText(input);
      expect(result).toBe('Senior Software Engineer');
    });

    it('should collapse 3 or more consecutive newlines into double newlines', () => {
      const input = 'Section 1\n\n\n\n\nSection 2\n\n\nSection 3';
      const result = cleanExtractedText(input);
      expect(result).toBe('Section 1\n\nSection 2\n\nSection 3');
    });

    it('should trim leading and trailing whitespace on individual lines and overall text', () => {
      const dirtySample =
        '\r\n\t  Alice   Smith   \r\n\n\n\n\x00Full-Stack   Developer\t\t\n\n\n\nSkills: React,   Node.js  \r\n\r\n';
      const cleaned = cleanExtractedText(dirtySample);
      expect(cleaned).toBe('Alice Smith\n\nFull-Stack Developer\n\nSkills: React, Node.js');
    });
  });

  describe('extractTextFromPdf', () => {
    const validPdfString =
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT\n/F1 18 Tf\n0 0 Td\n(Senior Software Engineer - Node.js) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000372 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n455\n%%EOF';

    it('should throw an error if input is not a buffer', async () => {
      await expect(extractTextFromPdf('not a buffer')).rejects.toThrow(
        'Expected a valid Buffer containing PDF data.'
      );
      await expect(extractTextFromPdf(null)).rejects.toThrow(
        'Expected a valid Buffer containing PDF data.'
      );
      await expect(extractTextFromPdf(undefined)).rejects.toThrow(
        'Expected a valid Buffer containing PDF data.'
      );
      await expect(extractTextFromPdf(12345)).rejects.toThrow(
        'Expected a valid Buffer containing PDF data.'
      );
    });

    it('should throw an error if buffer is empty', async () => {
      await expect(extractTextFromPdf(Buffer.alloc(0))).rejects.toThrow('PDF buffer is empty.');
    });

    it('should extract and clean text from a valid PDF binary buffer', async () => {
      const pdfBuffer = Buffer.from(validPdfString);
      const text = await extractTextFromPdf(pdfBuffer);
      expect(text).toContain('Senior Software Engineer - Node.js');
    });

    it('should throw a descriptive error when given corrupt/invalid PDF buffer', async () => {
      const corruptBuffer = Buffer.from('this is completely invalid pdf binary data');
      await expect(extractTextFromPdf(corruptBuffer)).rejects.toThrow(/Failed to parse PDF:/);
    });

    it('should expose cleanExtractedText and extractTextFromPdf as function properties', () => {
      expect(typeof extractTextFromPdf.cleanExtractedText).toBe('function');
      expect(typeof extractTextFromPdf.extractTextFromPdf).toBe('function');
    });
  });
});
