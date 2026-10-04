const { admin } = require('../config/firebase');

// A Firebase custom token that lets an examiner's browser READ (never write) its
// own batch's live counters through Firestore, so the Available/Total figures can
// use a real-time listener. It is scoped by claims: firestore.rules only allows
// a single `get` of batches/{examinerBatchId} and of that examiner's own
// allocation, and isAuthenticated() in the rules rejects tokens carrying the
// claim, so this identity cannot act as an Admin, Coach or student. Failing to
// mint it never blocks login - the screen then falls back to polling.
const mintExaminerFirebaseToken = async ({ batchId, examinerId }) => {
  try {
    return await admin.auth().createCustomToken(`examiner_${examinerId}`, {
      examinerBatchId: batchId,
      examinerId,
    });
  } catch (err) {
    return null;
  }
};

module.exports = { mintExaminerFirebaseToken };
