const User = require('../models/User');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

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

    // Generate JWT tokens
    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    // Return JWT and sanitized user object
    return res.status(201).json({
      token,
      accessToken: token,
      refreshToken,
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

    // Generate JWT tokens
    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    // Return JWT and sanitized user object
    return res.status(200).json({
      token,
      accessToken: token,
      refreshToken,
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

    // Ensure sensitive fields are omitted
    delete userResponse.passwordHash;
    delete userResponse.refreshToken;
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

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const refreshToken = (req.body && req.body.refreshToken) || req.headers['x-refresh-token'];

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Verify stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    // Generate new access token
    const accessToken = signToken(user._id);

    return res.status(200).json({
      accessToken,
      token: accessToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  refresh,
};
