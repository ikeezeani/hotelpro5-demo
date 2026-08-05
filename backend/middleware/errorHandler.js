const logger = require('../utils/logger');

function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  logger.error(`${req.method} ${req.originalUrl} :: ${err.message}`, { stack: err.stack });

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({ error: 'Database error processing your request.' });
  }

  res.status(status).json({
    error: err.publicMessage || err.message || 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

module.exports = { notFound, errorHandler, AppError };
