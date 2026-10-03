const { admin, db } = require('../config/firebase');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Verifies a Firebase ID token and that the user is an Admin - the same
// definition the Firestore rules use (a document at admins/{uid}). Controllers
// read the identity via getAdmin(req); the admin id is never taken from the
// request body.
const verifyAdmin = (handler) => async (req, res) => {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new UnauthorizedError('Missing or invalid Authorization header');

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  const adminDoc = await db.collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) throw new ForbiddenError('Admin access is required.');

  req.admin = { uid: decoded.uid };
  return handler(req, res);
};

const getAdmin = (req) => {
  if (!req || !req.admin || !req.admin.uid) throw new UnauthorizedError('Admin authentication is required.');
  return req.admin;
};

module.exports = { verifyAdmin, getAdmin };
