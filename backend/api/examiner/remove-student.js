const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken, getExaminer } = require('../../src/middleware/verifyExaminerToken');
const { db } = require('../../src/config/firebase');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require('../../src/utils/errors');
const { allocationsRef, buildCapacityView } = require('../../src/utils/examinerBatch');
const logger = require('../../src/utils/logger');

// Un-assigns a mistakenly added student from the authenticated examiner's own
// session, before the examination has started. The student's permanent record
// is kept (only the active batch assignment is cleared). The examiner's slot
// stays reserved for them - it becomes one of their remaining slots again -
// so the batch-wide available capacity is unchanged and no other examiner's
// allocation is touched. Everything is checked and written in one transaction.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);
  const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId.trim() : '';
  if (!studentId) {
    throw new ValidationError('studentId is required.');
  }

  const batchRef = db.collection('batches').doc(batchId);
  const studentRef = db.collection('students').doc(studentId);
  const allocRef = allocationsRef(batchId).doc(examinerId);
  const ownerQuery = allocationsRef(batchId).where('studentIds', 'array-contains', studentId).limit(1);

  const result = await db.runTransaction(async (tx) => {
    const [batchSnap, studentSnap, allocSnap, ownerSnap] = await Promise.all([
      tx.get(batchRef), tx.get(studentRef), tx.get(allocRef), tx.get(ownerQuery),
    ]);

    if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');
    if (!studentSnap.exists) throw new NotFoundError('Student not found.');

    const batch = batchSnap.data();
    const student = studentSnap.data();
    const alloc = allocSnap.exists ? allocSnap.data() : null;
    const myIds = alloc && Array.isArray(alloc.studentIds) ? alloc.studentIds : [];

    if (!myIds.includes(studentId)) {
      if (!ownerSnap.empty && ownerSnap.docs[0].id !== examinerId) {
        throw new ForbiddenError("This student belongs to another examiner's allocation. Ask that examiner or an Admin to correct it.");
      }
      if ((Array.isArray(batch.studentIds) ? batch.studentIds : []).includes(studentId)) {
        throw new ForbiddenError('This student was assigned by an Admin. Ask an Admin to change it.');
      }
      throw new NotFoundError('This student is not in your session.');
    }

    if (alloc.examStartedAt) {
      throw new ConflictError('The examination has already started - students can no longer be removed.');
    }
    if (student.testStatus && student.testStatus !== 'pending') {
      throw new ConflictError('This student has already been examined and cannot be removed.');
    }

    const now = new Date().toISOString();
    const nextBatchIds = (Array.isArray(batch.studentIds) ? batch.studentIds : []).filter((id) => id !== studentId);
    const nextAlloc = { ...alloc, studentIds: myIds.filter((id) => id !== studentId), updatedAt: now };
    const nextBatch = {
      ...batch,
      studentIds: nextBatchIds,
      allocatedAssigned: Math.max(0, (batch.allocatedAssigned || 0) - 1),
    };

    const batchUpdate = { studentIds: nextBatchIds, allocatedAssigned: nextBatch.allocatedAssigned, updatedAt: now };
    if (batch.status === 'filling' || batch.status === 'ongoing') {
      batchUpdate.status = nextBatchIds.length === 0 ? 'waiting' : 'filling';
    }

    tx.update(batchRef, batchUpdate);
    tx.update(allocRef, { studentIds: nextAlloc.studentIds, updatedAt: now });
    tx.update(studentRef, { batchId: null, scannedAt: null, updatedAt: now });

    return { batch: nextBatch, alloc: nextAlloc };
  });

  logger.info('Examiner removed student from session', {
    batchId, examinerId, studentId, correlationId: req.correlationId,
  });

  res.status(200).json({ success: true, studentId, capacity: buildCapacityView(result.batch, result.alloc) });
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(handler)));
