const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { allowCors } = require('../../src/middleware/withCors');
const { ValidationError } = require('../../src/utils/errors');
const { enqueueTask } = require('../../src/config/cloudTasks');
const { db } = require('../../src/config/firebase');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examDate, studentIds, force, retry } = req.body;

  if (!batchId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('batchId and studentIds array are required');
  }

  logger.info(`Starting bulk results send for ${studentIds.length} students via Cloud Tasks`, { batchId, correlationId: req.correlationId });

  // 1. Fetch the batch to verify it exists
  const batchRef = db.collection('batches').doc(batchId);
  const batchDoc = await batchRef.get();
  
  if (!batchDoc.exists) {
    throw new ValidationError('Batch not found');
  }

  // Fetch students in chunks if needed, but since it's an array of IDs we can fetch them
  const students = [];
  const chunkSize = 30; // Firestore 'in' queries support max 30, but we can just fetch one by one or query by batchId and filter
  
  const studentsQuery = db.collection('students').where('batchId', '==', batchId);
  const snapshot = await studentsQuery.get();
  
  snapshot.forEach(doc => {
    if (studentIds.includes(doc.id)) {
      students.push({ id: doc.id, ...doc.data() });
    }
  });

  if (students.length === 0) {
    throw new ValidationError('No valid students found for this batch');
  }

  // 2. Enqueue a task for each student
  const tasks = students.map(student => {
    const phone = student.phone || student.whatsapp;
    if (!phone) return Promise.resolve(null); // Skip if no phone

    const programName = student.programType === "SELAMBAM" ? "Selambam Championship" : "Karate Belt Test";
    const isPassed = student.testStatus === "passed" || student.testStatus === "pass";
    const statusText = isPassed ? "PASSED" : "COMPLETED";
    
    // We pass parameters assuming the template 'shadow_kai_result' has placeholders.
    // Adjust bodyParams based on what the template actually expects.
    const bodyParams = [
      student.name || student.firstName || 'Student',
      programName,
      `${statusText} (Score: ${student.score || 0})`
    ];

    return enqueueTask({
      studentId: student.id,
      phone,
      templateName: 'shadow_kai_result', // Template name provided by the user
      pdfUrl: student.resultPdfUrl || student.downloadUrl || student.pdfUrl || student.hallTicketUrl,
      pdfFilename: 'Results.pdf',
      storagePath: student.resultPdfPath || student.storagePath,
      pdfType: 'result',
      bodyParams,
      batchId,
      correlationId: `corr-result-${batchId}-${student.id}`
    });
  });

  // Await all tasks to be queued
  await Promise.all(tasks);

  // Update batch status to indicate we are sending
  await batchRef.update({
    whatsappStatus: 'sending',
    resultsSent: true,
    lastResultsSentAt: new Date().toISOString()
  });

  res.status(200).json({ 
    success: true, 
    message: `Successfully queued ${students.length} WhatsApp result messages via Google Cloud Tasks` 
  });
};

module.exports = allowCors(withErrorHandler(handler));
