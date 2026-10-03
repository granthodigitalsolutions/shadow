const { getExaminer } = require('../middleware/verifyExaminerToken');
const { db } = require('../config/firebase');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { allocationsRef, buildCapacityView } = require('../utils/examinerBatch');
const { newRecoveryKey, hashKey, normalizeName } = require('../utils/examinerRecovery');
const logger = require('../utils/logger');

const MAX_REMEMBERED_REQUESTS = 50;

// Reserves `quantity` of the batch's remaining slots for the authenticated
// examiner. Everything happens in one Firestore transaction that re-reads the
// batch, so concurrent examiners can never reserve the same slots or exceed
// maxSize. `requestId` makes retries / double-clicks idempotent: a request id
// already applied to this examiner's allocation returns the stored result
// without allocating again. Identity and batch come only from the verified
// token - never from the request body.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);
  const { quantity, requestId, examinerName } = req.body || {};

  const qty = typeof quantity === 'string' && /^\d+$/.test(quantity.trim()) ? Number(quantity) : quantity;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
    throw new ValidationError('Enter a whole number of slots greater than zero.');
  }
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) {
    throw new ValidationError('A valid requestId is required.');
  }

  const batchRef = db.collection('batches').doc(batchId);
  const allocRef = allocationsRef(batchId).doc(examinerId);
  const nameKey = normalizeName(examinerName);
  const displayName = typeof examinerName === 'string' ? examinerName.trim().replace(/\s+/g, ' ') : '';

  const result = await db.runTransaction(async (tx) => {
    const [batchSnap, allocSnap] = await Promise.all([tx.get(batchRef), tx.get(allocRef)]);
    if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');

    const batch = batchSnap.data();
    const existing = allocSnap.exists ? allocSnap.data() : null;
    const requestIds = existing && Array.isArray(existing.requestIds) ? existing.requestIds : [];

    // Retry of an already-committed request: no slots change. If the first
    // reply was lost, the retrying session gets a fresh recovery key.
    if (requestIds.includes(requestId)) {
      const key = newRecoveryKey();
      tx.update(allocRef, { recoveryHash: hashKey(key) });
      return { batch, alloc: { ...existing, recoveryHash: hashKey(key) }, replayed: true, recoveryKey: key };
    }

    // A first allocation must carry the examiner's name (used to find it again
    // if the browser's saved reference is lost) and the name must be free.
    let recoveryKey = null;
    if (!existing) {
      if (nameKey.length < 2 || displayName.length > 60) {
        throw new ValidationError('Enter your name (2-60 characters) so you can recover your slots later.');
      }
      const clash = await tx.get(allocationsRef(batchId).where('nameKey', '==', nameKey).limit(1));
      if (!clash.empty) {
        throw new ConflictError('That name already has slots in this batch. If that is you, use "Recover my slots" instead.');
      }
      recoveryKey = newRecoveryKey();
    }

    const { available } = buildCapacityView(batch, existing);
    if (qty > available) {
      throw new ConflictError(
        available === 0
          ? 'No slots are available in this batch.'
          : `Only ${available} slot${available === 1 ? '' : 's'} available - you asked for ${qty}.`
      );
    }

    const now = new Date().toISOString();
    const nextAlloc = {
      ...(existing || {}),
      ...(existing ? {} : { examinerName: displayName, nameKey, recoveryHash: hashKey(recoveryKey) }),
      examinerId,
      batchId,
      quantity: ((existing && existing.quantity) || 0) + qty,
      studentIds: existing && Array.isArray(existing.studentIds) ? existing.studentIds : [],
      requestIds: [...requestIds, requestId].slice(-MAX_REMEMBERED_REQUESTS),
      status: 'active',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    const nextBatch = { ...batch, allocatedCount: (batch.allocatedCount || 0) + qty };

    tx.set(allocRef, nextAlloc);
    tx.update(batchRef, { allocatedCount: nextBatch.allocatedCount, updatedAt: now });

    return { batch: nextBatch, alloc: nextAlloc, replayed: false, recoveryKey };
  });

  logger.info('Examiner allocated batch slots', {
    batchId,
    examinerId,
    quantity: qty,
    replayed: result.replayed,
    correlationId: req.correlationId,
  });

  res.status(200).json({
    success: true,
    replayed: result.replayed,
    // Only present when a key was just issued - the browser stores it as a hint.
    recovery: result.recoveryKey ? { allocationId: examinerId, recoveryKey: result.recoveryKey } : null,
    capacity: buildCapacityView(result.batch, result.alloc),
  });
};

module.exports = { handler };
