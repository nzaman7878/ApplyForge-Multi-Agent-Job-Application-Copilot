const { validationResult } = require('express-validator');

/**
 * Middleware to run validations and return 400 with errors if validation fails.
 * Usage: router.post('/route', validate(authValidators.login), handler)
 * @param {Array} validations - Array of express-validator rules
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors nicely
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  };
};

module.exports = validate;
