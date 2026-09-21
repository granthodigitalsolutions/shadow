const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken } = require('../../src/middleware/verifyExaminerToken');
const { db } = require('../../src/config/firebase');
const { NotFoundError } = require('../../src/utils/errors');
const { buildBatchSummary } = require('../../src/utils/examinerBatch');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId } = req.examiner;

  const batchDoc = await db.collection('batches').doc(batchId).get();

  if (!batchDoc.exists) {
    throw new NotFoundError('This batch no longer exists.');
  }

  const { summary, students } = await buildBatchSummary(batchDoc);

  const responseStudents = students.map((s) => ({
    id: s.id,
    name: s.name,
    gender: s.gender,
    school: s.school,
    beltLevel: s.beltLevel ?? null,
    beltIndex: s.beltIndex ?? null,
    stageLevel: s.stageLevel ?? null,
    programType: s.programType,
    testStatus: s.testStatus
  }));

  res.status(200).json({
    success: true,
    students: responseStudents,
    batch: summary
  });
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(handler)));
