const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const applicationController = require('../controllers/application.controller');

// All application routes require authentication
router.use(auth);

router.get('/', applicationController.getApplications);
router.get('/:id', applicationController.getApplicationById);
router.put('/:id', applicationController.updateApplication);
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;
