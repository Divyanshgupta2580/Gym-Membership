const mongoose = require('mongoose');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test';

  const testUri = process.env.MONGODB_URI_TEST;
  if (!testUri) {
    console.error('❌ MONGODB_URI_TEST environment variable is required for tests.');
    process.exit(1);
  }
  process.env.MONGODB_URI = testUri;
  await mongoose.connect(testUri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
