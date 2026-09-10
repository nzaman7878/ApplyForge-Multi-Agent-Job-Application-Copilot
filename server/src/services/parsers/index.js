const path = require('path');
const extractTextFromPdf = require('./pdfParser');
const extractTextFromDocx = require('./docxParser');
const { cleanExtractedText } = extractTextFromPdf;

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SUPPORTED_MIME_TYPES = [MIME_PDF, MIME_DOCX];

/**
 * Routes document buffer to the appropriate parser based on MIME type or file extension.
 *
 * @param {Buffer} buffer - Document binary buffer
 * @param {string} mimeType - MIME type of the uploaded file
 * @param {string} [filename=''] - Optional original filename for extension fallback
 * @param {Object} [options={}] - Additional parser options
 * @returns {Promise<string>} - Cleaned text extracted from the document
 */
const parseDocument = async (buffer, mimeType, filename = '', options = {}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid input: Expected a valid Buffer containing document data.');
  }

  const normalizedMime = (mimeType || '').trim().toLowerCase();
  const ext = filename ? path.extname(filename).toLowerCase() : '';

  // 1. PDF Routing
  if (normalizedMime === MIME_PDF || ext === '.pdf') {
    return extractTextFromPdf(buffer, options);
  }

  // 2. DOCX Routing
  if (normalizedMime === MIME_DOCX || normalizedMime === 'application/docx' || ext === '.docx') {
    return extractTextFromDocx(buffer, options);
  }

  // 3. Unsupported Type
  throw new Error(
    `Unsupported document type: "${mimeType || ext || 'unknown'}". Only PDF and DOCX files are supported.`
  );
};

parseDocument.parseDocument = parseDocument;
parseDocument.extractTextFromPdf = extractTextFromPdf;
parseDocument.extractTextFromDocx = extractTextFromDocx;
parseDocument.cleanExtractedText = cleanExtractedText;
parseDocument.SUPPORTED_MIME_TYPES = SUPPORTED_MIME_TYPES;

module.exports = parseDocument;
