const axios = require('axios');
const logger = require('../utils/logger');

const formatPhoneNumber = (phone) => {
  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }
  return formattedPhone;
};

const sendTemplateMessage = async ({ phone, templateName, bodyParams = [], pdfUrl, pdfFilename }) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp configuration missing in .env');
  }

  const formattedPhone = formatPhoneNumber(phone);
  const components = [];

  if (pdfUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: pdfUrl,
            filename: pdfFilename || "Document.pdf"
          }
        }
      ]
    });
  }

  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map(text => ({
        type: "text",
        text: text ? String(text) : " "
      }))
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
      components
    }
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const messageId = response.data?.messages?.[0]?.id;
    return { success: true, messageId, response: response.data };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    logger.error(`WhatsApp API failed: ${errorMessage}`, { status: error.response?.status, response: error.response?.data });
    throw new Error(`WhatsApp API failed: ${errorMessage}`);
  }
};

module.exports = { sendTemplateMessage, formatPhoneNumber };
