const rateLimit = require('express-rate-limit');
const { isTest } = require('../config/environment');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 25, // Limit each IP to 25 login/register attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again in 15 minutes.'
  }
});

const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 1000 : 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  standardLimiter
};
