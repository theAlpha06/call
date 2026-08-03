const logger = require('../config/logger');

function notFound(req, res, _next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Centralized error handler. Any controller that calls next(err) lands here.
function errorHandler(err, req, res, _next) {
  logger.error(err.message, { stack: err.stack, path: req.originalUrl });

  if (err.code === 11000) {
    // Mongo duplicate key - shouldn't normally surface since bulk endpoints
    // catch this per-item, but guard here too.
    return res.status(200).json({ success: true, message: 'Duplicate ignored' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message
  });
}

module.exports = { notFound, errorHandler };
