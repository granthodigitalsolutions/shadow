const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyCloudTasks } = require('../../src/middleware/verifyCloudTasks');
const { sendTemplateMessage } = require('../../src/services/whatsappService');
const { updateStudentStatus, appendWhatsAppLog } = require('../../src/services/studentService');
const logger = require('../../src/utils/logger');
const { admin, db } = require('../../src/config/firebase');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Google Cloud Tasks sends the payload as JSON in the body directly
  const { studentId, phone, templateName, pdfUrl, pdfFilename, bodyParams, campaignId, batchId, correlationId } = req.body;
  
  if (!phone || !templateName) {
    return res.status(400).json({ success: false, message: 'Missing phone or templateName' });
  }

  logger.info('Cloud Tasks Worker processing message', { studentId, phone, templateName, correlationId });

  try {
    if (studentId) {
      await updateStudentStatus(studentId, {
        whatsappStatus: 'sending',
        workerStartedAt: admin.firestore.FieldValue.serverTimestamp()
      }, correlationId);
    }

    const result = await sendTemplateMessage({ phone, templateName, pdfUrl, pdfFilename, bodyParams });

    if (studentId) {
      await updateStudentStatus(studentId, {
        whatsappStatus: 'sent',
        messageId: result.messageId,
        sentToMetaAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason: admin.firestore.FieldValue.delete(),
        retryCount: admin.firestore.FieldValue.increment(1)
      }, correlationId);

      // Update Batch/Campaign Counters
      if (batchId) {
        await db.collection('batches').doc(batchId).update({
          sentCount: admin.firestore.FieldValue.increment(1),
          queuedCount: admin.firestore.FieldValue.increment(-1)
        });
      }
    }

    await appendWhatsAppLog({
      campaignId: campaignId || null,
      studentId: studentId || null,
      batchId: batchId || null,
      messageId: result.messageId,
      status: 'sent',
      failureReason: null,
    }, correlationId);

    res.status(200).json({ success: true, messageId: result.messageId });
  } catch (error) {
    logger.error('Worker failed to send message', { error: error.message, correlationId });

    if (studentId) {
      await updateStudentStatus(studentId, {
        whatsappStatus: 'failed',
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason: error.message,
        retryCount: admin.firestore.FieldValue.increment(1)
      }, correlationId);
      
      if (batchId) {
        await db.collection('batches').doc(batchId).update({
          failedCount: admin.firestore.FieldValue.increment(1),
          queuedCount: admin.firestore.FieldValue.increment(-1)
        });
      }
    }

    await appendWhatsAppLog({
      campaignId: campaignId || null,
      studentId: studentId || null,
      batchId: batchId || null,
      status: 'failed',
      failureReason: error.message,
    }, correlationId);

    // Return 500 to trigger Cloud Tasks retry
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = withErrorHandler(verifyCloudTasks(handler));
