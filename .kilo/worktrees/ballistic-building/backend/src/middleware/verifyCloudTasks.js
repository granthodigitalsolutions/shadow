const { OAuth2Client } = require('google-auth-library');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

// We use the OAuth2Client to verify the OIDC token sent by Cloud Tasks
const client = new OAuth2Client();

const verifyCloudTasks = (handler) => {
  return async (req, res) => {
    try {
      // Allow bypass if explicitly developing locally and no tasks emulator
      if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        logger.info('Bypassing Cloud Tasks verification in local dev');
        return await handler(req, res);
      }

      // 1. Verify standard Cloud Tasks headers exist
      const queueName = req.headers['x-cloudtasks-queuename'];
      if (!queueName) {
        throw new UnauthorizedError('Missing Cloud Tasks headers');
      }

      // 2. Verify the OIDC Token
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid Authorization header');
      }

      const token = authHeader.split(' ')[1];

      // Audience is typically the URL of the worker endpoint
      const audience = process.env.WORKER_ENDPOINT_URL ? process.env.WORKER_ENDPOINT_URL.trim() : '';
      
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: audience,
      });

      const payload = ticket.getPayload();
      
      // 3. Verify it was invoked by the expected Service Account
      const expectedEmail = process.env.GCP_CLIENT_EMAIL ? process.env.GCP_CLIENT_EMAIL.trim() : '';
      if (payload.email !== expectedEmail) {
        throw new UnauthorizedError('Token not issued by expected service account');
      }

      await handler(req, res);
    } catch (error) {
      logger.error('Cloud Tasks OIDC verification failed', { error: error.message });
      res.status(401).json({ success: false, message: 'Unauthorized Cloud Tasks Request' });
    }
  };
};

module.exports = { verifyCloudTasks };
