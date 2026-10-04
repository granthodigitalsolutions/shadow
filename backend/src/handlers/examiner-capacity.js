const { getExaminer } = require('../middleware/verifyExaminerToken');
const { db } = require('../config/firebase');
const { NotFoundError } = require('../utils/errors');
const { allocationsRef, buildCapacityView } = require('../utils/examinerBatch');

// Lightweight live-capacity read (just the batch counters + this examiner's own
// allocation). The Examiner screen polls this every few seconds so the
// "available" figure follows what the other examiners on the same batch take.
const handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
  const { batchId, examinerId } = getExaminer(req);
  const [batchSnap, allocSnap] = await Promise.all([
    db.collection('batches').doc(batchId).get(),
    allocationsRef(batchId).doc(examinerId).get(),
  ]);
  if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');
  res.status(200).json({
    success: true,
    capacity: buildCapacityView(batchSnap.data(), allocSnap.exists ? allocSnap.data() : null),
    batchStatus: batchSnap.data().status || null,
  });
};

module.exports = { handler };
