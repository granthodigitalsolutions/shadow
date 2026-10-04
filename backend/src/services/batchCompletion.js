const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

// Batch completion, decided only from stored records (the batch, its assigned
// students and their saved results) - never from a counter the client sends.
//
//   Auto (examiner scores the last student): every assigned student has a
//   saved, valid result AND the batch is full (the existing "capacity fully
//   accounted for" rule).
//   Manual (Admin fallback): every assigned student has a saved, valid result;
//   the batch may be under capacity (that is what the fallback exists for).
// A student with no result, a result still being saved, or an invalid result
// (e.g. passed/failed without a numeric percentage) blocks completion.

const SCORED = new Set(['passed', 'failed', 'pass', 'fail']);

const hasValidResult = (s) =>
  !!s && SCORED.has(s.testStatus) && typeof s.percentage === 'number' && Number.isFinite(s.percentage);

const uniqueIds = (batch) => [...new Set(Array.isArray(batch.studentIds) ? batch.studentIds : [])];

/**
 * @param batch    batch document data
 * @param students Map of studentId -> student data (missing entry = unknown student)
 * @param opts     { requireFull: boolean }
 * @returns { ok, reason, pendingIds }
 */
const evaluateCompletion = (batch, students, { requireFull }) => {
  const ids = uniqueIds(batch);
  if (ids.length === 0) return { ok: false, reason: 'no_students', pendingIds: [] };
  const pendingIds = ids.filter((id) => !hasValidResult(students.get(id)));
  if (pendingIds.length > 0) return { ok: false, reason: 'pending_assessments', pendingIds };
  if (requireFull && ids.length < (Number.isInteger(batch.maxSize) ? batch.maxSize : ids.length + 1)) {
    return { ok: false, reason: 'not_full', pendingIds: [] };
  }
  return { ok: true, reason: null, pendingIds: [] };
};

/** Reads (inside a transaction) every student document of the batch. All reads - call before any write. */
const readBatchStudents = async (tx, db, batch) => {
  const ids = uniqueIds(batch);
  const snaps = await Promise.all(ids.map((id) => tx.get(db.collection('students').doc(id))));
  const map = new Map();
  snaps.forEach((snap, i) => { if (snap.exists) map.set(ids[i], snap.data()); });
  return map;
};

// Admin manual completion: same rules, enforced on the server, idempotent.
async function completeBatchManual({ db, adminUid, batchId, now = new Date() }) {
  if (typeof batchId !== 'string' || !batchId || batchId.includes('/')) {
    throw new ValidationError('batchId is required.');
  }
  const batchRef = db.collection('batches').doc(batchId);
  return db.runTransaction(async (tx) => {
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');
    const batch = batchSnap.data();
    if (batch.status === 'completed') return { batchId, status: 'completed', alreadyCompleted: true };

    const students = await readBatchStudents(tx, db, batch);
    const verdict = evaluateCompletion(batch, students, { requireFull: false });
    if (!verdict.ok) {
      if (verdict.reason === 'no_students') throw new ConflictError('This batch has no students, so there is nothing to complete.');
      const n = verdict.pendingIds.length;
      throw new ConflictError(`${n} student${n === 1 ? ' still has' : 's still have'} a pending or unsaved assessment. Finish scoring them first.`);
    }
    tx.update(batchRef, { status: 'completed', completedAt: now, completedBy: adminUid, updatedAt: now });
    return { batchId, status: 'completed', alreadyCompleted: false };
  });
}

module.exports = { evaluateCompletion, readBatchStudents, completeBatchManual, hasValidResult };
