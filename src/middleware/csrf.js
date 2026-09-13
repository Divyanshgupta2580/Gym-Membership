const crypto = require('crypto');
const logger = require('../utils/logger');
const { isTest } = require('../config/environment');

function csrfProtection(req, res, next) {
  if (!req.session) {
    return next();
  }

  // Ensure session has a unique CSRF token
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods do not require CSRF validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Allow explicit test bypass header for test suites that opt out
  if (isTest && req.headers['x-test-csrf-bypass'] === 'true') {
    return next();
  }

  const clientToken =
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    (req.query && req.query._csrf);

  if (!clientToken || clientToken !== req.session.csrfToken) {
    logger.warn('CSRF validation failure', {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token. Please refresh the page.'
      });
    }

    return res.status(403).render('errors/500', {
      title: 'Security Validation Error',
      statusCode: 403,
      message: 'Your form submission could not be verified for security reasons. Please refresh the page and try again.',
      errorId: 'CSRF_VALIDATION_FAILURE'
    });
  }

  next();
}

module.exports = {
  csrfProtection
};
