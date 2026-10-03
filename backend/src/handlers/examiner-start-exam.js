const { getExaminer } = require('../middleware/verifyExaminerToken');
const { db } = require('../config/firebase');
const { ConflictError, NotFoundError } = require('../utils/errors');
const { allocationsRef, buildCapacityView } = require('../utils/examinerBatch');

// Marks the authenticated examiner's session as started. From then on the
// backend refuses to remove their students (see remove-student.js). Idempotent:
// calling it again for an already-started session just reports the state.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);
  const batchRef = db.collection('batches').doc(batchId);
  const allocRef = allocationsRef(batchId).doc(examinerId);

  const result = await db.runTransaction(async (tx) => {
    const [batchSnap, allocSnap] = await Promise.all([tx.get(batchRef), tx.get(allocRef)]);
    if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');
    if (!allocSnap.exists || !(allocSnap.data().studentIds || []).length) {
      throw new ConflictError('Add at least one student before starting the examination.');
    }
    let alloc = allocSnap.data();
    if (!alloc.examStartedAt) {
      const now = new Date().toISOString();
      alloc = { ...alloc, examStartedAt: now, updatedAt: now };
      tx.update(allocRef, { examStartedAt: now, updatedAt: now });
      // Lets the Admin batch monitor show "In Progress" without reading allocations.
      if (!batchSnap.data().examStartedAt) tx.update(batchRef, { examStartedAt: now, updatedAt: now });
    }
    return { batch: batchSnap.data(), alloc };
  });

  res.status(200).json({ success: true, capacity: buildCapacityView(result.batch, result.alloc) });
};

module.exports = { handler };
