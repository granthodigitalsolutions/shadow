const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '12h';

// Fails with a clear, actionable message instead of letting jsonwebtoken's
// cryptic "secretOrPrivateKey must have a value" reach the client whenever
// the JWT_SECRET env var isn't set in the deployment (Vercel project
// settings -> Environment Variables -> JWT_SECRET, for every environment
// this function runs in, then redeploy).
const requireJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error(
      'Server misconfiguration: the JWT_SECRET environment variable is not set for this deployment. ' +
      'Set JWT_SECRET in the backend Vercel project\'s Environment Variables and redeploy.'
    );
  }
  return JWT_SECRET;
};

module.exports = { JWT_SECRET, TOKEN_EXPIRY, requireJwtSecret };
