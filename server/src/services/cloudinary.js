const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const stream = require('stream');
const config = require('../config/env');

/**
 * Configure Cloudinary with current environment or config options.
 */
function getCloudinaryClient() {
  const cloudName = config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY;
  const apiSecret = config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = config.cloudinary?.url || process.env.CLOUDINARY_URL;

  if (cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cloudinaryUrl, secure: true });
  } else if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  return cloudinary;
}

/**
 * Check if Cloudinary credentials are fully configured.
 * @returns {boolean}
 */
function isConfigured() {
  const cloudName = config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY;
  const apiSecret = config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = config.cloudinary?.url || process.env.CLOUDINARY_URL;

  return Boolean(cloudinaryUrl || (cloudName && apiKey && apiSecret));
}

/**
 * Upload a resume file (PDF or DOCX) to Cloudinary.
 * Accepts a file path string or a Buffer.
 *
 * @param {string|Buffer} fileInput - Path to the file on disk or Buffer
 * @param {Object} [options={}] - Custom Cloudinary upload options
 * @returns {Promise<{ url: string, secureUrl: string, publicId: string, format?: string, bytes?: number }>}
 */
async function uploadResumeFile(fileInput, options = {}) {
  const client = getCloudinaryClient();

  const defaultOptions = {
    folder: 'applyforge/resumes',
    resource_type: 'raw',
    use_filename: true,
    unique_filename: true,
    ...options,
  };

  // Case 1: Upload from Buffer
  if (Buffer.isBuffer(fileInput)) {
    return new Promise((resolve, reject) => {
      const uploadStream = client.uploader.upload_stream(
        defaultOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            resourceType: result.resource_type,
          });
        }
      );

      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileInput);
      bufferStream.pipe(uploadStream);
    });
  }

  // Case 2: Upload from file path
  if (typeof fileInput === 'string') {
    const result = await client.uploader.upload(fileInput, defaultOptions);
    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
    };
  }

  throw new Error('Invalid fileInput provided for Cloudinary upload. Expected string path or Buffer.');
}

/**
 * Delete a resume file from Cloudinary by public ID.
 *
 * @param {string} publicId - Cloudinary publicId of the resource
 * @param {Object} [options={}] - Custom options (defaults to resource_type: 'raw')
 * @returns {Promise<Object>}
 */
async function deleteResumeFile(publicId, options = {}) {
  if (!publicId) return { result: 'not_found' };

  const client = getCloudinaryClient();
  const deleteOptions = {
    resource_type: 'raw',
    ...options,
  };

  try {
    const result = await client.uploader.destroy(publicId, deleteOptions);
    return result;
  } catch (err) {
    console.warn(`Cloudinary deletion warning for ${publicId}:`, err.message);
    return { result: 'error', message: err.message };
  }
}

module.exports = {
  cloudinary,
  getCloudinaryClient,
  isConfigured,
  uploadResumeFile,
  deleteResumeFile,
};
