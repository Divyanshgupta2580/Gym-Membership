process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let isSafeTestDatabase = false;

function validateTestDatabase(uri) {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    throw new Error('MONGODB_URI_TEST environment variable is required for tests. Never falling back to MONGODB_URI.');
  }

  // Ensure testUri is not identical to MONGODB_URI if MONGODB_URI points to production or dev
  if (process.env.MONGODB_URI && uri.trim() === process.env.MONGODB_URI.trim()) {
    // If MONGODB_URI happens to be set to a non-test db, reject immediately
    const prodDevKeywords = ['prod', 'production', 'dev', 'development', 'staging'];
    const lower = uri.toLowerCase();
    for (const kw of prodDevKeywords) {
      if (lower.includes(kw)) {
        throw new Error('MONGODB_URI_TEST must not match development or production MONGODB_URI.');
      }
    }
  }

  let dbName = '';
  try {
    const url = new URL(uri);
    dbName = url.pathname.replace(/^\/+/, '').split('/')[0].split('?')[0];
  } catch (err) {
    // If standard URL parsing fails (e.g. complex replica set or custom scheme), fallback to regex parser
    const match = uri.match(/\/([a-zA-Z0-9_-]+)(\?|$)/);
    if (match) {
      dbName = match[1];
    }
  }

  if (!dbName) {
    throw new Error('Failed to parse database name from MONGODB_URI_TEST. Database name is missing.');
  }

  // Exact safety requirement:
  // Must be exactly gymflow_test or gymflow_test_<alphanumeric_suffix>
  const strictTestDbPattern = /^gymflow_test(_[a-zA-Z0-9]+)?$/;
  if (!strictTestDbPattern.test(dbName)) {
    throw new Error(
      `Unsafe test database name '${dbName}'. Test database name must be exactly 'gymflow_test' or 'gymflow_test_<alphanumeric_suffix>'.`
    );
  }

  // Explicitly reject forbidden names
  const forbidden = ['gymflow', 'development', 'production', 'staging', 'admin', 'test'];
  if (forbidden.includes(dbName.toLowerCase())) {
    throw new Error(`Forbidden database name '${dbName}' for testing.`);
  }

  return dbName;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'gymflow_test_session_secret_valid_entropy_32chars';

  const testUri = process.env.MONGODB_URI_TEST;
  validateTestDatabase(testUri);

  // Safety check passed
  isSafeTestDatabase = true;
  process.env.MONGODB_URI = testUri;

  await mongoose.connect(testUri, {
    serverSelectionTimeoutMS: 5000,
    runtimeAdapters: { os: require('os') }
  });
});

afterEach(async () => {
  if (isSafeTestDatabase && mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (isSafeTestDatabase && mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

