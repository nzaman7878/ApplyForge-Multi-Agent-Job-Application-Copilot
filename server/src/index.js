const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan(config.env === 'development' ? 'dev' : 'tiny'));

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'ApplyForge API is running' });
});
app.use('/api/auth', authRoutes);

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
