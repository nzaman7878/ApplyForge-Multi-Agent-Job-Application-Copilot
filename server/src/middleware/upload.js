const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Destination folder for resume uploads
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resumes');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 5MB limit
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

// File filter validation for MIME type and file extension
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

  if (isValidMime && isValidExt) {
    return cb(null, true);
  }

  const error = new Error('Invalid file type. Only PDF and DOCX files are allowed.');
  error.code = 'INVALID_FILE_TYPE';
  error.status = 400;
  return cb(error, false);
};

// Base multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

const { validateFileMagicBytes } = require('../utils/magicBytes');

/**
 * Middleware factory for single file uploads with unified 400 error handling
 * Supports a single field name or multiple acceptable field names (e.g., ['file', 'resume'])
 * @param {string|string[]} [fieldName='file']
 */
const handleUpload = (fieldName = 'file') => {
  return (req, res, next) => {
    let uploader;
    if (Array.isArray(fieldName)) {
      uploader = upload.fields(fieldName.map((name) => ({ name, maxCount: 1 })));
    } else {
      uploader = upload.single(fieldName);
    }

    uploader(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: 'File size exceeds the 5MB limit',
            code: 'LIMIT_FILE_SIZE',
          });
        }

        if (err.code === 'INVALID_FILE_TYPE' || err.status === 400) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only PDF and DOCX files are allowed',
            code: 'INVALID_FILE_TYPE',
          });
        }

        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            error: 'Upload error',
            message: err.message,
            code: err.code,
          });
        }

        return res.status(400).json({
          error: 'Upload error',
          message: err.message || 'Error uploading file',
        });
      }

      // If array of field names was passed, normalize req.file to the populated field
      if (Array.isArray(fieldName) && req.files) {
        for (const name of fieldName) {
          if (req.files[name] && req.files[name][0]) {
            req.file = req.files[name][0];
            break;
          }
        }
      }

      // Sanitize file upload with magic bytes inspection
      if (req.file) {
        try {
          let bufferChunk;
          if (req.file.buffer) {
            bufferChunk = req.file.buffer;
          } else if (req.file.path) {
            const handle = await fs.promises.open(req.file.path, 'r');
            const tempBuf = Buffer.alloc(2048);
            const { bytesRead } = await handle.read(tempBuf, 0, 2048, 0);
            await handle.close();
            bufferChunk = tempBuf.subarray(0, bytesRead);
          }

          const validation = validateFileMagicBytes(
            bufferChunk,
            req.file.mimetype || req.file.originalname
          );

          if (!validation.isValid) {
            // Delete invalid or dangerous file from disk immediately
            if (req.file.path) {
              await fs.promises.unlink(req.file.path).catch(() => {});
            }
            req.file = null;
            return res.status(400).json({
              error: 'Invalid file signature',
              message: validation.reason || 'File content does not match allowed PDF or DOCX format',
              code: validation.code || 'INVALID_FILE_SIGNATURE',
            });
          }
        } catch (sanitizeErr) {
          if (req.file && req.file.path) {
            await fs.promises.unlink(req.file.path).catch(() => {});
          }
          return res.status(400).json({
            error: 'Upload validation error',
            message: sanitizeErr.message || 'Failed to validate uploaded file signature',
            code: 'FILE_VALIDATION_FAILED',
          });
        }
      }

      next();
    });
  };
};

upload.handleUpload = handleUpload;
upload.handleResumeUpload = handleUpload(['file', 'resume']);
upload.UPLOAD_DIR = UPLOAD_DIR;
upload.MAX_FILE_SIZE = MAX_FILE_SIZE;
upload.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
upload.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;

module.exports = upload;
