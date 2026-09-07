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

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user;
    try {
      user = await User.findByCredentials(email.toLowerCase(), password);
    } catch (authError) {
      return res.status(401).json({
        error: 'Invalid login credentials',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = signToken(user._id);

    // Return JWT and sanitized user object
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process login',
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me (protected)
 */
const getMe = async (req, res) => {
  try {
    const user = req.user;

    const userResponse = user.toJSON
      ? user.toJSON()
      : {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        };

    if (!userResponse.id && userResponse._id) {
      userResponse.id = userResponse._id;
    }

    // Ensure passwordHash is not present
    delete userResponse.passwordHash;
    delete userResponse.__v;

    return res.status(200).json({
      ...userResponse,
      user: userResponse,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve current user',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
