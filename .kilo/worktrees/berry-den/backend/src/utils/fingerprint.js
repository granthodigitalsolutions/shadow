const crypto = require('crypto');

/**
 * Normalizes a string by converting to lowercase and removing special characters/spaces.
 * @param {string} str - The string to normalize
 * @returns {string} - The normalized string or empty string if falsy
 */
const normalize = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Normalizes a mobile number (extracts last 10 digits if possible, else keeps numeric only)
 * @param {string} mobile 
 * @returns {string}
 */
const normalizeMobile = (mobile) => {
  if (!mobile) return '';
  const numericOnly = String(mobile).replace(/\D/g, '');
  if (numericOnly.length >= 10) {
    return numericOnly.slice(-10);
  }
  return numericOnly;
};

/**
 * Generates a deterministic fingerprint for a registration record.
 * Used for detecting duplicates within the database and upload batches.
 * 
 * @param {Object} student 
 * @param {string} student.program
 * @param {string} student.eventId
 * @param {string} student.parentMobile (or phone, whatsapp)
 * @param {string} student.name
 * @param {string} student.belt (or stage)
 * @param {string} student.standard
 * @returns {string} The SHA-256 fingerprint hash
 */
const generateRegistrationFingerprint = (student) => {
  if (!student) return '';

  const program = normalize(student.program);
  const eventId = normalize(student.eventId || student.beltTestId);
  const mobileRaw = student.parentMobile || student.phone || student.whatsapp || student.parentPhoneNumber || '';
  const mobile = normalizeMobile(mobileRaw);
  const name = normalize(student.name);
  const belt = normalize(student.belt || student.stage);
  const standard = normalize(student.standard);

  const rawString = `${program}|${eventId}|${mobile}|${name}|${belt}|${standard}`;
  
  return crypto.createHash('sha256').update(rawString).digest('hex');
};

module.exports = {
  generateRegistrationFingerprint,
  normalize,
  normalizeMobile
};
