const axios = require('axios');
const { TEMPLATES } = require('../config/constants');

const formatPhoneNumber = (phone) => {
  let formattedPhone = phone.replace(/\D/g, '');
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

  // If pdfUrl is provided, attach it to the template header
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

  // Add body parameters
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map(text => ({
        type: "text",
        text: text ? String(text) : " " // Ensure it's a string, avoid empty strings breaking API
      }))
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" 
      },
      components: components
    }
  };

  console.log("==========================================");
  console.log("WHATSAPP CLOUD API REQUEST PAYLOAD:");
  console.log(`Template Name: ${templateName}`);
  console.log(`Language Code: ${payload.template.language.code}`);
  console.log("WhatsApp URL:", `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`);
  console.log("Phone Number ID:", phoneNumberId);
  console.log("Token Prefix:", token.substring(0, 20));
  console.log("Full Payload JSON:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("==========================================");

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
    console.error("WhatsApp API Error Status:", error.response?.status);
    console.error("Full Error Response:", JSON.stringify(error.response?.data, null, 2));
    
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`[WhatsApp API Error] ${errorMessage}`);
    throw new Error(`WhatsApp API failed: ${errorMessage}`);
  }
};

const sendTextMessage = async ({ phone, text }) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp configuration missing in .env');
  }

  const formattedPhone = formatPhoneNumber(phone);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: { preview_url: false, body: text }
  };

  console.log("==========================================");
  console.log("WHATSAPP CLOUD API REQUEST PAYLOAD (TEXT):");
  console.log("Phone Number ID:", phoneNumberId);
  console.log("Token Prefix:", token.substring(0, 20));
  console.log("Full Payload JSON:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("==========================================");

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
    console.error("WhatsApp API Error Status:", error.response?.status);
    console.error("Full Error Response:", JSON.stringify(error.response?.data, null, 2));
    
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`[WhatsApp API Error] ${errorMessage}`);
    throw new Error(`WhatsApp API failed: ${errorMessage}`);
  }
};

module.exports = {
  sendTemplateMessage,
  sendTextMessage,
  formatPhoneNumber
};
