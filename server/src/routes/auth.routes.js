const express = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { register, login } = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', validate(register), authController.register);
router.post('/login', loginLimiter, validate(login), authController.login);
router.get('/me', auth, authController.getMe);

module.exports = router;
