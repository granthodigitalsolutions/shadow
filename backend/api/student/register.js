const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { db, admin } = require('../../src/config/firebase');
const logger = require('../../src/utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { name, phone, type, feePaid, beltColor } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }

  const newStudent = {
    name,
    phone,
    type: type || 'standard',
    feePaid: feePaid || 0,
    beltColor: beltColor || 'White',
    paymentStatus: 'pending',
    whatsappStatus: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await db.collection('students').add(newStudent);
  
  logger.info('Registered new student via API', { studentId: docRef.id });

  res.status(201).json({
    success: true,
    message: 'Student registered successfully',
    studentId: docRef.id,
    data: newStudent
  });
};

module.exports = allowCors(withErrorHandler(handler));
