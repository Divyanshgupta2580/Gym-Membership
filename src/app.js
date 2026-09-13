const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { createSessionMiddleware } = require('./config/session');
const { attachUser } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const { setupLocals } = require('./middleware/locals');
const { layoutMiddleware } = require('./middleware/layout');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

function createApp(customMongoUri) {
  const app = express();

  // Trust reverse proxy headers (Render / TLS termination)
  app.set('trust proxy', 1);

  // View Engine Configuration
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:']
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  // Static Assets
  app.use('/public', express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, 'public')));

  // Body and Cookie Parsing
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Session Management
  const sessionMiddleware = createSessionMiddleware(customMongoUri);
  app.use(sessionMiddleware);

  // User Authentication Context
  app.use(attachUser);

  // Cross-Site Request Forgery Protection
  app.use(csrfProtection);

  // Template Locals & View Helpers
  app.use(setupLocals);

  // EJS Layout Engine
  app.use(layoutMiddleware);

  // Application Routes
  app.use(routes);

  // Centralized Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, sessionMiddleware };
}

module.exports = createApp;
