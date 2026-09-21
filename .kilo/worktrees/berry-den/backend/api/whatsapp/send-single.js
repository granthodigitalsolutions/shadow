const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { allowCors } = require('../../src/middleware/withCors');
const { ValidationError } = require('../../src/utils/errors');
const { sendTemplateMessage } = require('../../src/services/whatsappService');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { phone, templateName, pdfUrl, pdfFilename, bodyParams } = req.body;

  if (!phone || !templateName) {
    throw new ValidationError('Phone and templateName are required');
  }

  logger.info('Sending single WhatsApp message', { phone, templateName, correlationId: req.correlationId });

  const result = await sendTemplateMessage({
    phone,
    templateName,
    pdfUrl,
    pdfFilename,
    bodyParams
  });

  res.status(200).json({ success: true, messageId: result.messageId });
};

module.exports = allowCors(withErrorHandler(handler));
