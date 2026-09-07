const User = require('../models/User');
const { signToken } = require('../utils/jwt');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'A user with this email address already exists',
      });
    }

    // Create and save user
    const user = new User({
      name,
      email,
      passwordHash: password,
    });

    await user.save();

    // Generate JWT token
    const token = signToken(user._id);

    // Return JWT and sanitized user object
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'A user with this email address already exists',
      });
    }

    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register user',
    });
  }
};

module.exports = {
  register,
};
