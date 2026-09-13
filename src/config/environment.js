const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const PORT = parseInt(process.env.PORT || '3000', 10);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gymflow';
const SESSION_SECRET = process.env.SESSION_SECRET || 'gymflow_default_dev_session_secret_replace_in_production_32chars';
const EXPIRING_SOON_THRESHOLD_DAYS = parseInt(process.env.EXPIRING_SOON_THRESHOLD_DAYS || '7', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || (isTest ? 'error' : 'info');

if (isProd && SESSION_SECRET === 'gymflow_default_dev_session_secret_replace_in_production_32chars') {
  throw new Error('In production, SESSION_SECRET must be explicitly configured with a secure random value.');
}

if (isProd && (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost') || process.env.MONGODB_URI.includes('127.0.0.1'))) {
  throw new Error('In production, MONGODB_URI must be explicitly configured with a valid remote MongoDB Atlas connection string.');
}

module.exports = {
  NODE_ENV,
  isProd,
  isTest,
  PORT,

  MONGODB_URI,
  SESSION_SECRET,
  EXPIRING_SOON_THRESHOLD_DAYS,
  LOG_LEVEL
};
