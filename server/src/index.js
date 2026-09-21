const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth.routes');
const resumeRoutes = require('./routes/resume.routes');
const jdRoutes = require('./routes/jd.routes');
const pipelineRoutes = require('./routes/pipeline.routes');
const applicationRoutes = require('./routes/application.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// Trust reverse proxy hops (e.g. Railway, Render, Vercel, AWS ALB) for accurate IP rate limiting
app.set('trust proxy', 1);

// Security Middleware: Helmet with granular Content Security Policy (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'blob:'],
        connectSrc: [
          "'self'",
          'https://api.cloudinary.com',
          'https://generativelanguage.googleapis.com',
        ],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Security Middleware: CORS with whitelist from environment
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser or local tool requests without Origin header
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Check direct equality or wildcard
    if (config.corsOrigins.includes('*') || config.corsOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Support wildcard subdomains e.g. *.vercel.app or .vercel.app
    const isAllowedPattern = config.corsOrigins.some((allowed) => {
      if (allowed.startsWith('*.')) {
        const rootDomain = allowed.slice(2);
        return normalizedOrigin.endsWith(rootDomain);
      }
      if (allowed.startsWith('.')) {
        return normalizedOrigin.endsWith(allowed);
      }
      return false;
    });

    if (isAllowedPattern) {
      return callback(null, true);
    }

    const error = new Error(`Origin ${origin} is not allowed by CORS whitelist`);
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'X-Test-Cache',
    'X-Test-Rate-Limit',
    'Cache-Control',
  ],
};
app.use(cors(corsOptions));

// Handle CORS errors with clean 403 response
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Forbidden',
      message: err.message,
    });
  }
  next(err);
});

// Performance & Parsing Middleware
app.use(compression());
app.use(express.json());
app.use(morgan(config.env === 'development' ? 'dev' : 'tiny'));

// Global API Rate Limiter
app.use('/api', apiLimiter);

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'ApplyForge API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jds', jdRoutes);
app.use('/api/jd', jdRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 Not Found Handler for Unmatched API Routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProd = config.env === 'production';
  if (!isProd && statusCode === 500) {
    console.error('Unhandled Application Error:', err);
  }
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: isProd && statusCode === 500 ? 'An unexpected server error occurred' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// Start Server
const startServer = async () => {
  await connectDB();

  return app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port} in ${config.env} mode`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
