const jwt = require('jsonwebtoken');
const { requireJwtSecret } = require('../config/examinerAuth');
const { UnauthorizedError } = require('../utils/errors');

const verifyExaminerToken = (handler) => async (req, res) => {
  // Fails clearly (500, distinct from an expired/invalid token) if the
  // server itself is misconfigured, rather than misreporting it to the
  // Examiner as "please re-enter the batch code".
  const jwtSecret = requireJwtSecret();

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  let payload;
  try {
    payload = jwt.verify(match[1], jwtSecret);
  } catch (err) {
    throw new UnauthorizedError('Session expired. Please re-enter the batch code.');
  }

  req.examiner = { batchId: payload.batchId };

  return handler(req, res);
};

module.exports = { verifyExaminerToken };
