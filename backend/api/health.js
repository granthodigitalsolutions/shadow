const { allowCors } = require('../../src/middleware/withCors');

const handler = async (req, res) => {
  res.status(200).json({
    success: true,
    status: 'Backend Running',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};

module.exports = allowCors(handler);
