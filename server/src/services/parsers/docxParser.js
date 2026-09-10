const mammoth = require('mammoth');
const { cleanExtractedText } = require('./pdfParser');

/**
 * Extracts and cleans text from a DOCX binary Buffer.
 *
 * @param {Buffer} buffer - Binary buffer of the DOCX file
 * @param {Object} [options={}] - Additional mammoth options
 * @returns {Promise<string>} - Cleaned text string extracted from the DOCX document
 */
const extractTextFromDocx = async (buffer, options = {}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid input: Expected a valid Buffer containing DOCX data.');
  }

  if (buffer.length === 0) {
    throw new Error('Invalid input: DOCX buffer is empty.');
  }

  try {
    const result = await mammoth.extractRawText({ buffer, ...options });
    const rawText = result && typeof result.value === 'string' ? result.value : '';

    return cleanExtractedText(rawText);
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
};

extractTextFromDocx.extractTextFromDocx = extractTextFromDocx;
extractTextFromDocx.cleanExtractedText = cleanExtractedText;

module.exports = extractTextFromDocx;
