const crypto = require('crypto');

// Recovery keys let a returning examiner prove they own an existing
// allocation. The key is a random secret handed to that browser once; only
// its SHA-256 hash is stored with the allocation. It is a capability for ONE
// allocation in ONE batch - not a login credential - and it never replaces the
// batch-scoped session token.
const newRecoveryKey = () => crypto.randomBytes(24).toString('hex');
const hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

const keyMatches = (alloc, key) => {
  if (!alloc || typeof alloc.recoveryHash !== 'string' || typeof key !== 'string' || !key) return false;
  const a = Buffer.from(alloc.recoveryHash, 'hex');
  const b = Buffer.from(hashKey(key), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Examiners identify themselves by name when they first reserve slots; this
// normalised form is what "already reserved earlier?" recovery matches on.
const normalizeName = (name) =>
  typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';

module.exports = { newRecoveryKey, hashKey, keyMatches, normalizeName };
