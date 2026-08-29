const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan(config.env === 'development' ? 'dev' : 'tiny'));

// Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'ApplyForge API is running' });
});

// Start Server
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port} in ${config.env} mode`);
});
