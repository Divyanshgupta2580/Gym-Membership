const session = require('express-session');
const MongoStore = require('connect-mongo');
const { SESSION_SECRET, MONGODB_URI, isProd, isTest } = require('./environment');

function createSessionMiddleware(customUri) {
  const uri = customUri || MONGODB_URI;

  const storeOptions = {
    mongoUrl: uri,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day in seconds
    autoRemove: 'native',
    touchAfter: 60 * 60 // Lazy session update once per hour if unmodified
  };

  const store = isTest
    ? new session.MemoryStore()
    : MongoStore.create(storeOptions);

  return session({
    name: 'gymflow.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in ms
    }
  });
}

module.exports = {
  createSessionMiddleware
};
