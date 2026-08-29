const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async (retries = 5) => {
  if (!config.mongoose.url) {
    console.warn('MongoDB URI is not defined in the environment. Skipping database connection.');
    return;
  }

  while (retries > 0) {
    try {
      await mongoose.connect(config.mongoose.url);
      console.log('Successfully connected to MongoDB.');
      break;
    } catch (err) {
      console.error(`MongoDB connection error: ${err.message}`);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      
      if (retries === 0) {
        console.error('Could not connect to MongoDB after multiple attempts. Exiting...');
        process.exit(1);
      }
      
      // Wait for 5 seconds before retrying
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination.');
  }
};

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = { connectDB, disconnectDB };
