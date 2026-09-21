const jwt = require('jsonwebtoken');
const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { db } = require('../../src/config/firebase');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');
const { TOKEN_EXPIRY, requireJwtSecret } = require('../../src/config/examinerAuth');
const { buildBatchSummary } = require('../../src/utils/examinerBatch');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const jwtSecret = requireJwtSecret();

  const { code } = req.body;
  const trimmedCode = typeof code === 'string' ? code.trim() : '';

  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new ValidationError('Please enter a valid 6-digit code');
  }

  const snapshot = await db.collection('batches').where('code', '==', trimmedCode).limit(1).get();

  if (snapshot.empty) {
    throw new NotFoundError('No batch found for this code. Please check and try again.');
  }

  const batchDoc = snapshot.docs[0];
  const { summary } = await buildBatchSummary(batchDoc);

  const token = jwt.sign({ batchId: batchDoc.id }, jwtSecret, { expiresIn: TOKEN_EXPIRY });

  logger.info('Examiner verified batch code', {
    batchId: batchDoc.id,
    correlationId: req.correlationId
  });

  res.status(200).json({
    success: true,
    token,
    batch: summary
  });
};

module.exports = allowCors(withErrorHandler(handler));
