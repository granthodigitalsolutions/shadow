const jwt = require('jsonwebtoken');
const { getExaminer } = require('../middleware/verifyExaminerToken');
const { db } = require('../config/firebase');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { TOKEN_EXPIRY, requireJwtSecret } = require('../config/examinerAuth');
const { allocationsRef, buildCapacityView } = require('../utils/examinerBatch');
const { newRecoveryKey, hashKey, keyMatches, normalizeName } = require('../utils/examinerRecovery');
const { mintExaminerFirebaseToken } = require('../utils/examinerFirebase');
const logger = require('../utils/logger');

// Session recovery. The batch comes only from the verified token; the client
// may add hints (allocationId + recoveryKey, or the examiner name used when
// reserving). This endpoint is read-mostly and NEVER reserves slots - it only
// finds the examiner's existing allocation and, if found, re-binds a fresh
// session token to it. Results (all HTTP 200 unless auth/permission fails):
//   recovered          - existing allocation found; `token` is bound to it
//   invalid            - the hint did not match a usable allocation
//   no_allocation      - nothing to recover and slots can be reserved
//   capacity_exhausted - nothing to recover and no slots remain
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);
  const { allocationId, recoveryKey, examinerName } = req.body || {};

  if (allocationId !== undefined && (typeof allocationId !== 'string' || allocationId.length > 100)) {
    throw new ValidationError('Invalid allocationId.');
  }
  if (recoveryKey !== undefined && (typeof recoveryKey !== 'string' || recoveryKey.length > 200)) {
    throw new ValidationError('Invalid recoveryKey.');
  }
  if (examinerName !== undefined && typeof examinerName !== 'string') {
    throw new ValidationError('Invalid examinerName.');
  }

  const batchSnap = await db.collection('batches').doc(batchId).get();
  if (!batchSnap.exists) throw new NotFoundError('This batch no longer exists.');
  const batch = batchSnap.data();
  const col = allocationsRef(batchId);

  const recovered = async (snap, { rotate }) => {
    let alloc = snap.data();
    let issuedKey = null;
    if (rotate || !alloc.recoveryHash) {
      issuedKey = newRecoveryKey();
      alloc = { ...alloc, recoveryHash: hashKey(issuedKey) };
      await col.doc(snap.id).update({ recoveryHash: alloc.recoveryHash, updatedAt: new Date().toISOString() });
    }
    const token = jwt.sign({ batchId, examinerId: snap.id }, requireJwtSecret(), { expiresIn: TOKEN_EXPIRY });
    const firebaseToken = await mintExaminerFirebaseToken({ batchId, examinerId: snap.id });
    logger.info('Examiner session recovered', { batchId, allocationId: snap.id, correlationId: req.correlationId });
    return res.status(200).json({
      success: true,
      result: 'recovered',
      token,
      firebaseToken,
      allocationId: snap.id,
      // Only present when a key was (re)issued; otherwise the browser keeps its own.
      recoveryKey: issuedKey,
      capacity: buildCapacityView(batch, alloc),
    });
  };

  // 1. Saved allocation reference + key (browser Local Storage hint).
  let hintFailed = false;
  if (allocationId || recoveryKey) {
    const snap = allocationId ? await col.doc(allocationId).get() : null;
    if (snap && snap.exists && keyMatches(snap.data(), recoveryKey) && snap.data().status === 'active') {
      return recovered(snap, { rotate: false });
    }
    // Same outcome for "missing", "wrong key" and "released": reveals nothing.
    hintFailed = true;
  }

  // 2. Name used when the slots were reserved (works after storage is cleared).
  const nameKey = normalizeName(examinerName);
  if (nameKey) {
    const found = await col.where('nameKey', '==', nameKey).limit(1).get();
    if (!found.empty && found.docs[0].data().status === 'active') {
      return recovered(found.docs[0], { rotate: true });
    }
  }

  // 3. This very session already owns an allocation (refresh / legacy data).
  const own = await col.doc(examinerId).get();
  if (own.exists && own.data().status === 'active') {
    return recovered(own, { rotate: false });
  }

  const view = buildCapacityView(batch, null);
  res.status(200).json({
    success: true,
    result: hintFailed ? 'invalid' : view.available > 0 ? 'no_allocation' : 'capacity_exhausted',
    capacity: view,
  });
};

module.exports = { handler };
