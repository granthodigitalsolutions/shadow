const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const crypto = require('crypto');

const withErrorHandler = (handler) => {
  return async (req, res) => {
    // Generate correlation ID
    req.correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Unhandled error in API route:', error);
      logger.error('Unhandled error in API route', {
        correlationId: req.correlationId,
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message,
            code: error.code
          }
        });
      }

      // Default 500 error
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Internal Server Error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
};

module.exports = { withErrorHandler };
