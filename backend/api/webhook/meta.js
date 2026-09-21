const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { db, admin } = require('../../src/config/firebase');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  // 1. Webhook Verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ? process.env.WHATSAPP_VERIFY_TOKEN.trim() : '';
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook verified successfully');
      return res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed', { mode, token });
      return res.status(403).send('Verification Failed');
    }
  }

  // 2. Webhook Event Processing (POST request from Meta)
  if (req.method === 'POST') {
    const { object, entry } = req.body;
    
    if (object === 'whatsapp_business_account' && entry && entry.length > 0) {
      for (const ent of entry) {
        if (!ent.changes || ent.changes.length === 0) continue;

        for (const change of ent.changes) {
          const value = change.value;

          // Process status updates
          if (value.statuses && value.statuses.length > 0) {
            for (const statusObj of value.statuses) {
              const { id: messageId, status, timestamp, recipient_id } = statusObj;
              
              logger.info(`Received WhatsApp status update: ${status}`, { messageId, recipient_id });
              
              try {
                // Update whatsappLogs collection
                const logsSnapshot = await db.collection('whatsappLogs')
                  .where('messageId', '==', messageId)
                  .get();
                
                if (!logsSnapshot.empty) {
                  const batch = db.batch();
                  let studentId = null;

                  logsSnapshot.forEach(doc => {
                    studentId = doc.data().studentId;
                    batch.update(doc.ref, { 
                      status, 
                      [`${status}At`]: admin.firestore.FieldValue.serverTimestamp() 
                    });
                  });

                  // Update students collection
                  if (studentId) {
                    const studentRef = db.collection('students').doc(studentId);
                    batch.update(studentRef, {
                      whatsappStatus: status,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                  }

                  await batch.commit();
                }
              } catch (error) {
                logger.error('Error processing webhook status update', { error: error.message, messageId });
              }
            }
          }
          
          // Note: Inbound messages (value.messages) could also be processed here if needed
        }
      }
    }
    
    // Always return 200 OK to Meta immediately so they don't retry
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};

module.exports = withErrorHandler(handler);
