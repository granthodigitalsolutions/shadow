const { storage, db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Optionally verifies if a file exists in Firebase Storage, 
 * then saves the metadata (storagePath, downloadUrl) to the student document in Firestore.
 */
const verifyAndSavePdfMetadata = async (studentId, storagePath, downloadUrl, pdfType = 'hallticket') => {
  try {
    if (!studentId || !storagePath || !downloadUrl) {
      throw new Error('Missing required PDF metadata (studentId, storagePath, downloadUrl)');
    }

    // Optional: Verify file exists in Firebase Storage
    try {
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      
      if (!exists) {
        logger.warn('PDF file does not exist in Firebase Storage at specified path', { storagePath });
        // We could throw here, but we'll log a warning in case public URLs are used differently
        // throw new Error('File not found in storage');
      }
    } catch (storageError) {
      logger.error('Error verifying Firebase Storage file', { error: storageError.message });
      // Proceed anyway, as it could be a permissions issue with Admin SDK on bucket
    }

    const studentRef = db.collection('students').doc(studentId);
    const updateData = {};
    
    if (pdfType === 'hallticket') {
      updateData.hallTicketUrl = downloadUrl;
      updateData.hallTicketStoragePath = storagePath;
      updateData.hallTicketGeneratedAt = new Date().toISOString();
      updateData.hallTicketStatus = 'generated';
    } else if (pdfType === 'result') {
      updateData.resultPdfUrl = downloadUrl;
      updateData.resultStoragePath = storagePath;
      updateData.resultGeneratedAt = new Date().toISOString();
      updateData.resultStatus = 'generated';
    } else {
      throw new Error(`Unknown pdfType: ${pdfType}`);
    }

    await studentRef.update(updateData);
    logger.info(`Saved ${pdfType} PDF metadata for ${studentId}`, { studentId, storagePath });
    
    return true;
  } catch (error) {
    logger.error('Failed to verify and save PDF metadata', { error: error.message, studentId });
    throw error;
  }
};

module.exports = { verifyAndSavePdfMetadata };
