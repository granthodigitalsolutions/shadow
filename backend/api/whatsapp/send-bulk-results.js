const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { allowCors } = require('../../src/middleware/withCors');
const { ValidationError } = require('../../src/utils/errors');
const { enqueueTask } = require('../../src/config/cloudTasks');
const { db } = require('../../src/config/firebase');
const logger = require('../../src/utils/logger');

// Statuses that mean a student's WhatsApp result message is already in
// flight or done — enqueueing again for these (without `force`) would
// create a duplicate Cloud Task and double-message a real parent/student.
const DONE_STATUSES = new Set(['queued', 'sending', 'sent', 'delivered', 'read']);

const FIRESTORE_BATCH_LIMIT = 500;

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examDate, studentIds, force } = req.body;

  if (!batchId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ValidationError('batchId and studentIds array are required');
  }

  logger.info(`Starting bulk results send for ${studentIds.length} students via Cloud Tasks`, { batchId, force: !!force, correlationId: req.correlationId });

  // 1. Fetch the batch to verify it exists
  const batchRef = db.collection('batches').doc(batchId);
  const batchDoc = await batchRef.get();

  if (!batchDoc.exists) {
    throw new ValidationError('Batch not found');
  }

  // Fetch students in chunks if needed, but since it's an array of IDs we can fetch them
  const students = [];

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

  // 2. Idempotency: skip anyone already queued/sent unless explicitly forced.
  const toProcess = force ? students : students.filter(s => !DONE_STATUSES.has(s.whatsappStatus));
  const skipped = force ? [] : students.filter(s => DONE_STATUSES.has(s.whatsappStatus));

  if (toProcess.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'All targeted students are already queued or sent.',
      enqueued: 0,
      skipped: skipped.length
    });
  }

  // 3. Stamp `whatsappStatus: 'queued'` BEFORE enqueueing, in the same
  // request, so a second near-simultaneous call (double-click, or an
  // overlapping chunk run) sees the fresh status and skips these students
  // too — process-message.js only sets a status once the Cloud Task worker
  // actually runs, which is too late to prevent a duplicate enqueue here.
  const now = new Date().toISOString();
  for (const idsChunk of chunkArray(toProcess.map(s => s.id), FIRESTORE_BATCH_LIMIT)) {
    const stampBatch = db.batch();
    idsChunk.forEach(id => {
      stampBatch.update(db.collection('students').doc(id), { whatsappStatus: 'queued', queuedAt: now });
    });
    await stampBatch.commit();
  }

  // 4. Enqueue a task for each student, isolating per-task failures so one
  // rejection doesn't fail the whole request and doesn't 500 the caller
  // after other students have already been correctly stamped/queued.
  const failedToEnqueue = [];
  const tasks = toProcess.map(async (student) => {
    const phone = student.phone || student.whatsapp;
    if (!phone) {
      failedToEnqueue.push(student.id);
      return null;
    }

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

    try {
      return await enqueueTask({
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
    } catch (err) {
      logger.error('Failed to enqueue WhatsApp result task', { studentId: student.id, batchId, error: err.message, correlationId: req.correlationId });
      failedToEnqueue.push(student.id);
      return null;
    }
  });

  await Promise.all(tasks);

  // 5. Revert the "queued" stamp for anyone whose task never actually got
  // created (missing phone, or enqueueTask threw) — leaving them stuck on
  // "queued" would silently block both a normal re-run and a manual retry.
  if (failedToEnqueue.length > 0) {
    for (const idsChunk of chunkArray(failedToEnqueue, FIRESTORE_BATCH_LIMIT)) {
      const revertBatch = db.batch();
      idsChunk.forEach(id => {
        revertBatch.update(db.collection('students').doc(id), {
          whatsappStatus: 'failed',
          failureReason: 'Could not queue message (missing phone number or dispatch error)'
        });
      });
      await revertBatch.commit();
    }
  }

  const enqueuedCount = toProcess.length - failedToEnqueue.length;

  // Update batch status to indicate we are sending — only if something was
  // actually queued (previously this ran unconditionally, even when every
  // target was skipped/failed).
  if (enqueuedCount > 0) {
    await batchRef.update({
      whatsappStatus: 'sending',
      resultsSent: true,
      lastResultsSentAt: new Date().toISOString()
    });
  }

  res.status(200).json({
    success: true,
    message: `Queued ${enqueuedCount} WhatsApp result message(s). ${skipped.length} already sent/queued, ${failedToEnqueue.length} failed to enqueue.`,
    enqueued: enqueuedCount,
    skipped: skipped.length,
    failedToEnqueue: failedToEnqueue.length
  });
};

module.exports = allowCors(withErrorHandler(handler));
