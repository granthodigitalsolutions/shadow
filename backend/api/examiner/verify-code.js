const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { db } = require('../../src/config/firebase');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { TOKEN_EXPIRY, requireJwtSecret } = require('../../src/config/examinerAuth');
const { buildBatchSummary } = require('../../src/utils/examinerBatch');
const { mintExaminerFirebaseToken } = require('../../src/utils/examinerFirebase');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const jwtSecret = requireJwtSecret();

  const { code, batchId } = req.body;
  const trimmedCode = typeof code === 'string' ? code.trim() : '';

  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new ValidationError('Please enter a valid 6-digit code');
  }

  const snapshot = await db.collection('batches').where('code', '==', trimmedCode).limit(1).get();

  if (snapshot.empty) {
    throw new NotFoundError('This code or QR is not valid. It may have been replaced or the batch removed - ask an Admin for the current QR.');
  }

  const batchDoc = snapshot.docs[0];
  // A QR names its batch: the code must belong to exactly that batch, so a
  // copied or stale QR can never open a different one.
  if (batchId !== undefined && (typeof batchId !== 'string' || batchDoc.id !== batchId)) {
    throw new NotFoundError('This QR does not match the batch it was printed for. Ask an Admin for the current QR.');
  }
  const { summary } = await buildBatchSummary(batchDoc);

  const examinerId = crypto.randomUUID();
  const firebaseToken = await mintExaminerFirebaseToken({ batchId: batchDoc.id, examinerId });
  const token = jwt.sign({ batchId: batchDoc.id, examinerId }, jwtSecret, { expiresIn: TOKEN_EXPIRY });

  logger.info('Examiner verified batch code', {
    batchId: batchDoc.id,
    correlationId: req.correlationId
  });

  res.status(200).json({
    success: true,
    token,
    firebaseToken,
    batch: summary
  });
};

module.exports = allowCors(withErrorHandler(handler));
