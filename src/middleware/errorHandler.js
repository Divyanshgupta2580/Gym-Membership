const crypto = require('crypto');
const logger = require('../utils/logger');
const { isProd } = require('../config/environment');

function isApiRequest(req) {
  return Boolean(
    req.originalUrl?.startsWith('/api/') ||
    req.path?.startsWith('/api/') ||
    req.xhr ||
    req.headers.accept?.includes('application/json')
  );
}

function notFoundHandler(req, res, next) {
  if (isApiRequest(req)) {
    return res.status(404).json({
      success: false,
      message: `Resource not found: ${req.method} ${req.originalUrl}`
    });
  }

  res.status(404).render('errors/404', {
    title: 'Page Not Found',
    path: req.originalUrl
  });
}

function errorHandler(err, req, res, next) {
  const errorId = `ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const statusCode = err.status || err.statusCode || 500;

  logger.error('Unhandled application exception', {
    errorId,
    statusCode,
    message: err.message,
    stack: isProd ? undefined : err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id?.toString()
  });

  if (res.headersSent) {
    return next(err);
  }

  if (isApiRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      errorId,
      message: statusCode >= 500
        ? 'An unexpected server error occurred. Please try again later.'
        : err.message
    });
  }

  res.status(statusCode).render('errors/500', {
    title: statusCode === 403 ? 'Access Denied' : 'Server Error',
    statusCode,
    errorId,
    message: statusCode >= 500
      ? 'An internal error occurred. Our engineering team has been notified with your reference ID.'
      : err.message
  });
}

module.exports = {
  isApiRequest,
  notFoundHandler,
  errorHandler
};
