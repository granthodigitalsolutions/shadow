const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyAdmin, getAdmin } = require('../../src/middleware/verifyAdmin');
const { db } = require('../../src/config/firebase');
const { reviewPayments } = require('../../src/services/paymentReview');
const logger = require('../../src/utils/logger');

// Admin-only bulk payment review: POST { action: 'confirm' | 'reject',
// studentIds, requestId, reason? }. See src/services/paymentReview.js.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { uid } = getAdmin(req);
  const outcome = await reviewPayments({ db, adminUid: uid, body: req.body });

  logger.info('Admin reviewed payments', {
    adminUid: uid,
    action: outcome.action,
    counts: outcome.counts,
    correlationId: req.correlationId,
  });

  res.status(200).json({ success: true, partial: outcome.counts.failed > 0, ...outcome });
};

module.exports = allowCors(withErrorHandler(verifyAdmin(handler)));
