const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { allowCors } = require('../../src/middleware/withCors');
const { ValidationError } = require('../../src/utils/errors');
const { verifyAndSavePdfMetadata } = require('../../src/services/pdfService');
const { enqueueTask } = require('../../src/config/cloudTasks');
const { db } = require('../../src/config/firebase');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { studentId } = req.body;
  let pdfUrl = req.body.pdfUrl;

  if (!studentId) {
    throw new ValidationError('studentId is required');
  }

  logger.info('Processing hall ticket webhook from frontend', { studentId, correlationId: req.correlationId });

  // 1. Fetch student to get phone number and other details
  const studentRef = db.collection('students').doc(studentId);
  const studentDoc = await studentRef.get();

  if (!studentDoc.exists) {
    throw new ValidationError('Student not found');
  }

  const studentData = studentDoc.data();
  
  if (!pdfUrl) {
    pdfUrl = studentData.hallTicketUrl || studentData.receiptUrl;
    if (!pdfUrl) {
      throw new ValidationError('pdfUrl is required (either in request body or student record)');
    }
  }


  // Ensure phone number exists
  const phone = studentData.phone || studentData.whatsapp;
  if (!phone) {
    throw new ValidationError('Student does not have a valid phone number');
  }

  // 2. We can guess the storage path from the pdfUrl, but since the frontend 
  // didn't pass it, we can just save the URL. We'll pass a placeholder storage path
  // or parse it from the URL.
  // The url looks like: https://firebasestorage.googleapis.com/.../halltickets%2Fstudent123.pdf
  let storagePath = `halltickets/${studentId}.pdf`; 
  
  // 3. Save Metadata
  await verifyAndSavePdfMetadata(studentId, storagePath, pdfUrl, 'hallticket');

  // 4. Fetch location link from active belt test for this program
  let locationText = studentData.programType || 'KARATE';
  if (studentData.programType) {
    try {
      const beltTestsSnapshot = await db.collection('beltTests')
        .where('programType', '==', studentData.programType)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      if (!beltTestsSnapshot.empty) {
        const testData = beltTestsSnapshot.docs[0].data();
        if (testData.locationLink) {
          locationText = testData.locationLink;
        }
      }
    } catch (err) {
      logger.error('Failed to fetch belt test location', { error: err.message });
    }
  }

  // 5. Enqueue WhatsApp Task
  await enqueueTask({
    studentId,
    phone,
    templateName: 'registration_success', // Updated template name per user instruction
    pdfUrl,
    pdfFilename: 'HallTicket.pdf',
    pdfType: 'hallticket',
    bodyParams: [studentData.name || studentData.firstName || 'Student', locationText],
    correlationId: `corr-hallticket-${studentId}`
  });

  return res.status(200).json({ success: true, message: 'Hall ticket secured and WhatsApp notification queued' });
};

module.exports = allowCors(withErrorHandler(handler));
