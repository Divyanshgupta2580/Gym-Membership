const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { MONGODB_URI, isTest } = require('./environment');

let isConnected = false;

async function connectDatabase(uri = MONGODB_URI) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    mongoose.set('strictQuery', true);
    
    // Mask credentials from URI before logging
    const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    logger.info('Initiating MongoDB connection', { target: maskedUri });

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      runtimeAdapters: { os: require('os') }
    });

    isConnected = true;
    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB runtime connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      if (!isTest) {
        logger.warn('MongoDB connection lost');
      }
    });

    return conn;
  } catch (error) {
    logger.error('MongoDB connection failure', { error: error.message });
    throw error;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected cleanly');
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase
};
