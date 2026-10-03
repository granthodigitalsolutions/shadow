const { ValidationError } = require('../utils/errors');

const CHUNK = 50; // 2 writes per student -> well inside Firestore's 500-write transaction limit
const MAX_IDS = 200;
const ID_RE = /^[A-Za-z0-9_-]{8,100}$/;

const parseRequest = (body) => {
  const { action, studentIds, requestId, reason } = body || {};
  if (action !== 'confirm' && action !== 'reject') throw new ValidationError("action must be 'confirm' or 'reject'.");
  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > MAX_IDS) {
    throw new ValidationError(`studentIds must list 1-${MAX_IDS} students.`);
  }
  const ids = [...new Set(studentIds)];
  if (ids.some((id) => typeof id !== 'string' || !id || id.includes('/') || id.length > 200)) {
    throw new ValidationError('studentIds contains an invalid id.');
  }
  if (typeof requestId !== 'string' || !ID_RE.test(requestId)) {
    throw new ValidationError('A valid requestId is required.');
  }
  const note = typeof reason === 'string' ? reason.trim() : '';
  if (note.length > 200) throw new ValidationError('reason is too long (max 200 characters).');
  if (action === 'reject' && note.length < 3) throw new ValidationError('A rejection reason is required.');
  return { action, ids, requestId, note };
};

// Confirms or rejects pending payments for a list of students. Each chunk is
// one Firestore transaction that re-reads every student, so only records that
// are STILL pending at commit time change - an already-confirmed payment can
// never be silently overwritten, and a retry (same requestId) cannot
// double-apply because each (requestId, student) pair owns one audit entry.
// Failures are reported per student; the call never claims all-or-nothing.
async function reviewPayments({ db, adminUid, body, now = new Date() }) {
  const { action, ids, requestId, note } = parseRequest(body);
  const target = action === 'confirm' ? 'verified' : 'rejected';
  const results = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const chunkResults = await db.runTransaction(async (tx) => {
        const studentRefs = chunk.map((id) => db.collection('students').doc(id));
        const auditRefs = chunk.map((id) => db.collection('paymentAudit').doc(`${requestId}_${id}`));
        const [studentSnaps, auditSnaps] = await Promise.all([
          Promise.all(studentRefs.map((r) => tx.get(r))),
          Promise.all(auditRefs.map((r) => tx.get(r))),
        ]);

        return chunk.map((id, idx) => {
          const snap = studentSnaps[idx];
          if (!snap.exists) return { studentId: id, outcome: 'failed', reason: 'not_found' };
          if (auditSnaps[idx].exists) return { studentId: id, outcome: 'skipped', reason: 'already_processed' };

          const student = snap.data();
          if (student.isDeleted) return { studentId: id, outcome: 'failed', reason: 'not_found' };
          const current = student.paymentStatus || 'pending';
          if (current !== 'pending') {
            return { studentId: id, outcome: 'skipped', reason: current === 'verified' ? 'already_confirmed' : 'already_rejected' };
          }

          const pd = student.paymentDetails || {};
          const amount = pd.amount;
          if (action === 'confirm' && !(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) {
            return { studentId: id, outcome: 'failed', reason: 'missing_fee' };
          }

          const update = { paymentStatus: target, paymentReviewedBy: adminUid, paymentReviewedAt: now, updatedAt: now };
          if (action === 'confirm') {
            update.confirmedBy = adminUid;
            update.confirmedAt = now;
            // Administrative confirmation - not a verified online gateway transaction.
            update.paymentDetails = { ...pd, confirmationType: 'admin_manual' };
          } else {
            update.rejectionReason = note;
          }
          tx.update(studentRefs[idx], update);
          tx.set(auditRefs[idx], {
            requestId,
            studentId: id,
            action,
            previousStatus: current,
            newStatus: target,
            amount: typeof amount === 'number' ? amount : null,
            reason: note || null,
            source: 'admin_manual',
            adminUid,
            at: now,
          });
          return { studentId: id, outcome: 'updated' };
        });
      });
      results.push(...chunkResults);
    } catch (err) {
      // Nothing from this chunk was committed; report it and keep going.
      chunk.forEach((id) => results.push({ studentId: id, outcome: 'failed', reason: 'transaction_error' }));
    }
  }

  const counts = { updated: 0, skipped: 0, failed: 0 };
  results.forEach((r) => { counts[r.outcome]++; });
  return { action, results, counts };
}

module.exports = { reviewPayments, parseRequest };
