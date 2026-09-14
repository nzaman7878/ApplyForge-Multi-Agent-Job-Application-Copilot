const VALID_STATUSES = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected'];

/**
 * Middleware: validate status enum on PATCH and PUT update requests.
 * Validates that if `status` is provided in `req.body`, it must be one of the
 * supported CRM statuses: wishlist, applied, interviewing, offer, rejected.
 *
 * Responds with 400 Bad Request if invalid.
 */
function validateStatus(req, res, next) {
  const { status } = req.body;

  // Status is optional in partial updates (PATCH)
  if (status === undefined) {
    return next();
  }

  // Reject non-strings or empty strings
  if (typeof status !== 'string' || !status.trim()) {
    return res.status(400).json({
      error: 'Invalid status',
      message: `Status must be a non-empty string. Allowed values: ${VALID_STATUSES.join(', ')}`,
      validStatuses: VALID_STATUSES,
      received: status,
    });
  }

  const normalizedStatus = status.trim().toLowerCase();

  // Validate against allowed enum
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      error: 'Invalid status',
      message: `Invalid status "${status}". Allowed values: ${VALID_STATUSES.join(', ')}`,
      validStatuses: VALID_STATUSES,
      received: status,
    });
  }

  req.body.status = normalizedStatus;
  return next();
}

module.exports = validateStatus;
module.exports.VALID_STATUSES = VALID_STATUSES;
