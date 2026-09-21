const { db, admin } = require('../config/firebase');
const logger = require('../utils/logger');

const getStudent = async (studentId) => {
  const doc = await db.collection('students').doc(studentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const updateStudentStatus = async (studentId, statusData, correlationId) => {
  try {
    await db.collection('students').doc(studentId).update({
      ...statusData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    logger.info('Updated student status', { studentId, statusData, correlationId });
  } catch (error) {
    logger.error('Failed to update student status', { error: error.message, studentId, correlationId });
    throw error;
  }
};

const appendWhatsAppLog = async (logData, correlationId) => {
  try {
    const logRef = db.collection('whatsappLogs').doc();
    await logRef.set({
      ...logData,
      correlationId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Failed to append WhatsApp log', { error: error.message, correlationId });
    // Don't throw, it's just a log
  }
};

module.exports = { getStudent, updateStudentStatus, appendWhatsAppLog };
