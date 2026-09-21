const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { allowCors } = require('../../src/middleware/withCors');
const { ValidationError } = require('../../src/utils/errors');
const { enqueueTask } = require('../../src/config/cloudTasks');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { students, templateName, campaignId, batchId } = req.body;

  if (!students || !Array.isArray(students) || students.length === 0) {
    throw new ValidationError('Students array is required and must not be empty');
  }

  if (!templateName) {
    throw new ValidationError('Template name is required');
  }

  logger.info(`Starting bulk send for ${students.length} students via Cloud Tasks`, { campaignId, batchId, correlationId: req.correlationId });

  // Enqueue a task for each student
  const tasks = students.map(student => {
    return enqueueTask({
      studentId: student.id || student.studentId,
      phone: student.phone || student.whatsapp,
      templateName,
      pdfUrl: student.downloadUrl || student.pdfUrl || student.hallTicketUrl,
      storagePath: student.storagePath,
      pdfType: student.pdfType || 'hallticket',
      bodyParams: student.bodyParams || [],
      campaignId,
      batchId,
      correlationId: `corr-${campaignId || 'batch'}-${student.id || student.studentId}`
    });
  });

  // Await all tasks to be queued
  // If array is very large, consider chunking Promise.all
  await Promise.all(tasks);

  res.status(200).json({ 
    success: true, 
    message: `Successfully queued ${students.length} WhatsApp messages via Google Cloud Tasks` 
  });
};

module.exports = allowCors(withErrorHandler(handler));
