const winston = require('winston');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'secret',
  'sessionSecret',
  'authorization',
  'cookie'
]);

function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactSensitiveData(val);
    } else {
      redacted[key] = val;
    }
  }
  return redacted;
}

const sanitizeFormat = winston.format((info) => {
  const sanitized = { ...info };
  if (sanitized.metadata) {
    sanitized.metadata = redactSensitiveData(sanitized.metadata);
  }
  return sanitized;
});

const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isTest ? 'error' : 'info');

const transports = [
  new winston.transports.Console({
    silent: isTest && !process.env.DEBUG_TESTS,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      sanitizeFormat(),
      winston.format.printf(({ timestamp, level, message, metadata }) => {
        const metaStr = metadata && Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
      })
    )
  })
];

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gymflow-core' },
  transports
});

module.exports = logger;
