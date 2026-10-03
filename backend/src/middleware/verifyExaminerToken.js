const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { requireJwtSecret } = require('../config/examinerAuth');
const { UnauthorizedError, NotFoundError } = require('../utils/errors');

// Verifies the batch-scoped Examiner JWT and attaches a *verified*
// `req.examiner = { batchId, examinerId }` before the controller runs.
// - 401: missing/invalid/expired token, or a token without a batch + examiner
//   identity (e.g. issued before examiner identities existed).
// - 404: the batch the token was issued for no longer exists.
// Controllers must still read the identity through getExaminer(req) so an
// accidentally unwrapped route fails with a controlled 401, not a TypeError.
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

  if (
    !payload ||
    typeof payload.batchId !== 'string' || !payload.batchId ||
    typeof payload.examinerId !== 'string' || !payload.examinerId
  ) {
    throw new UnauthorizedError('Session is no longer valid. Please re-enter the batch code.');
  }

  const batchSnap = await db.collection('batches').doc(payload.batchId).get();
  if (!batchSnap.exists) {
    throw new NotFoundError('This batch no longer exists.');
  }

  req.examiner = { batchId: payload.batchId, examinerId: payload.examinerId };

  return handler(req, res);
};

// Defensive accessor used by every protected controller.
const getExaminer = (req) => {
  const examiner = req && req.examiner;
  if (!examiner || !examiner.batchId || !examiner.examinerId) {
    throw new UnauthorizedError('Examiner authentication is required.');
  }
  return examiner;
};

module.exports = { verifyExaminerToken, getExaminer };
