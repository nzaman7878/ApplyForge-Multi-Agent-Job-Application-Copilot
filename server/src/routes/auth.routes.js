const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { register } = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', validate(register), authController.register);

module.exports = router;
