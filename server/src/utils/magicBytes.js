/**
 * File Signature (Magic Bytes) Validator
 * Inspects raw file binary buffers to verify true file types and reject spoofed/malicious uploads.
 */

// Known file signatures
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const ZIP_MAGIC_BYTES_1 = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (standard zip / docx)
const ZIP_MAGIC_BYTES_2 = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // PK\x05\x06 (empty zip)
const ZIP_MAGIC_BYTES_3 = Buffer.from([0x50, 0x4b, 0x07, 0x08]); // PK\x07\x08 (spanned zip)

// Prohibited executable signatures
const EXE_MZ = Buffer.from([0x4d, 0x5a]); // Windows MZ executable
const ELF_BIN = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // Linux ELF
const SHELL_SHEBANG = Buffer.from([0x23, 0x21]); // #! script

/**
 * Checks if buffer starts with given signature bytes.
 * @param {Buffer} buffer
 * @param {Buffer} signature
 * @returns {boolean}
 */
function matchesHeader(buffer, signature) {
  if (!buffer || buffer.length < signature.length) return false;
  return buffer.subarray(0, signature.length).equals(signature);
}

/**
 * Checks if a buffer represents a valid PDF file.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isPdfBuffer(buffer) {
  if (!buffer || buffer.length < 5) return false;
  // Check exact header %PDF-
  if (matchesHeader(buffer, PDF_MAGIC_BYTES)) {
    return true;
  }
  // ISO 32000-1 allows %PDF- within the first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
  return headerSlice.indexOf(PDF_MAGIC_BYTES) !== -1;
}

/**
 * Checks if a buffer represents a valid DOCX / ZIP archive.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isDocxBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return (
    matchesHeader(buffer, ZIP_MAGIC_BYTES_1) ||
    matchesHeader(buffer, ZIP_MAGIC_BYTES_2) ||
    matchesHeader(buffer, ZIP_MAGIC_BYTES_3)
  );
}

/**
 * Checks if a buffer matches known executable or script signatures.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isExecutableOrScript(buffer) {
  if (!buffer || buffer.length < 2) return false;

  if (matchesHeader(buffer, EXE_MZ)) return true;
  if (matchesHeader(buffer, ELF_BIN)) return true;
  if (matchesHeader(buffer, SHELL_SHEBANG)) return true;

  // Check for common script tags in first 100 bytes
  const textPrefix = buffer.subarray(0, Math.min(buffer.length, 100)).toString('utf8').toLowerCase();
  if (textPrefix.includes('<script') || textPrefix.includes('<?php')) {
    return true;
  }

  return false;
}

/**
 * Validates file buffer against its declared MIME type or extension.
 * @param {Buffer} buffer - File buffer
 * @param {string} [declaredTypeOrExt=''] - MIME type or filename/extension
 * @returns {{ isValid: boolean, detectedType?: string, reason?: string, code?: string }}
 */
function validateFileMagicBytes(buffer, declaredTypeOrExt = '') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      isValid: false,
      reason: 'Empty or invalid file buffer',
      code: 'EMPTY_FILE',
    };
  }

  // 1. Immediately reject executable / script payloads
  if (isExecutableOrScript(buffer)) {
    return {
      isValid: false,
      reason: 'Prohibited binary executable or script format detected',
      code: 'PROHIBITED_FILE_SIGNATURE',
    };
  }

  const isPdf = isPdfBuffer(buffer);
  const isDocx = isDocxBuffer(buffer);

  // 2. Identify detected type
  let detectedType = null;
  if (isPdf) {
    detectedType = 'pdf';
  } else if (isDocx) {
    detectedType = 'docx';
  }

  if (!detectedType) {
    return {
      isValid: false,
      reason: 'File content does not match allowed PDF or DOCX binary signatures',
      code: 'INVALID_FILE_SIGNATURE',
    };
  }

  // 3. Verify match against declared MIME type or extension if provided
  const declared = (declaredTypeOrExt || '').toLowerCase();
  const isDeclaredPdf = declared.includes('pdf');
  const isDeclaredDocx = declared.includes('docx') || declared.includes('wordprocessingml');

  if (isDeclaredPdf && detectedType !== 'pdf') {
    return {
      isValid: false,
      reason: 'Declared PDF file does not have valid PDF magic bytes',
      code: 'INVALID_FILE_SIGNATURE',
    };
  }

  if (isDeclaredDocx && detectedType !== 'docx') {
    return {
      isValid: false,
      reason: 'Declared DOCX file does not have valid OpenXML/ZIP magic bytes',
      code: 'INVALID_FILE_SIGNATURE',
    };
  }

  return {
    isValid: true,
    detectedType,
  };
}

module.exports = {
  validateFileMagicBytes,
  isPdfBuffer,
  isDocxBuffer,
  isExecutableOrScript,
};
