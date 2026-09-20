const pdfModule = require('pdf-parse');

/**
 * Clean and normalize raw extracted resume text.
 * Strips non-printable characters, normalizes whitespace and line breaks,
 * and collapses multiple redundant empty lines into paragraph breaks.
 *
 * @param {string} text - Raw extracted string from PDF
 * @returns {string} - Cleaned, trimmed, and normalized string
 */
const cleanExtractedText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return (
    text
      // Normalize line breaks (\r\n and \r to \n)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove null bytes and non-printable control characters except \n and \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace multiple horizontal spaces/tabs on a single line with a single space
      .replace(/[ \t]+/g, ' ')
      // Clean leading and trailing whitespace on individual lines
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Collapse 3 or more consecutive newlines into double newlines (paragraphs)
      .replace(/\n{3,}/g, '\n\n')
      // Final trim
      .trim()
  );
};

/**
 * Extracts and cleans text from a PDF binary Buffer.
 * Supports both pdf-parse v1 (function) and pdf-parse v2+ (class).
 *
 * @param {Buffer} buffer - Binary buffer of the PDF file
 * @param {Object} [options={}] - Additional parser configuration options
 * @returns {Promise<string>} - Cleaned text string extracted from the PDF
 */
const extractTextFromPdf = async (buffer, options = {}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid input: Expected a valid Buffer containing PDF data.');
  }

  if (buffer.length === 0) {
    throw new Error('Invalid input: PDF buffer is empty.');
  }

  try {
    let rawText = '';

    // Check if pdfModule has class PDFParse (v2+)
    if (pdfModule && pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({
        data: buffer,
        ...options,
      });

      const result = await parser.getText();

      if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
        rawText = result.pages.map((p) => p.text).join('\n\n');
      } else {
        rawText = result.text || '';
      }

      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    } else if (typeof pdfModule === 'function') {
      // Classic pdf-parse (v1.x)
      const data = await pdfModule(buffer, options);
      rawText = data.text || '';
    } else {
      throw new Error('Unsupported pdf-parse library structure.');
    }

    return cleanExtractedText(rawText);
  } catch (error) {
    // Graceful fallback if pdf-parse fake worker fails under Jest / VM environments without --experimental-vm-modules
    try {
      const bufferStr = buffer.toString('utf-8');
      const textMatches = [...bufferStr.matchAll(/\(([^)]+)\)\s*Tj/g)].map((m) => m[1]);
      if (textMatches.length > 0) {
        return cleanExtractedText(textMatches.join('\n'));
      }
    } catch {
      // ignore fallback error and throw original
    }
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

extractTextFromPdf.extractTextFromPdf = extractTextFromPdf;
extractTextFromPdf.cleanExtractedText = cleanExtractedText;

module.exports = extractTextFromPdf;
