const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const applicationValidators = require('../validators/application.validators');
const applicationController = require('../controllers/application.controller');

// All application routes require authentication
router.use(auth);

// POST /api/applications — create (triggered by pipeline approve or manual input)
router.post(
  '/',
  validate(applicationValidators.createApplication),
  applicationController.createApplication
);

// GET /api/applications — list with pagination and filtering by status
router.get(
  '/',
  validate(applicationValidators.listApplications),
  applicationController.getApplications
);

// GET /api/applications/:id — full detail
router.get('/:id', applicationController.getApplicationById);

// PATCH /api/applications/:id — update status, follow-up dates, notes
router.patch(
  '/:id',
  validate(applicationValidators.updateApplication),
  applicationController.updateApplication
);

// PUT /api/applications/:id — full/partial update (backward compatibility)
router.put(
  '/:id',
  validate(applicationValidators.updateApplication),
  applicationController.updateApplication
);

// DELETE /api/applications/:id — delete application
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;
