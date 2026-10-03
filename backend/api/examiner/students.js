const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken, getExaminer } = require('../../src/middleware/verifyExaminerToken');
const { db } = require('../../src/config/firebase');
const { NotFoundError } = require('../../src/utils/errors');
const { buildBatchSummary, allocationsRef, buildCapacityView } = require('../../src/utils/examinerBatch');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);

  const batchDoc = await db.collection('batches').doc(batchId).get();

  if (!batchDoc.exists) {
    throw new NotFoundError('This batch no longer exists.');
  }

  const { summary, students: allStudents } = await buildBatchSummary(batchDoc);

  // An examiner sees only their own allocation's students, plus students that
  // were assigned outside the allocation flow (legacy/Admin) — never another
  // examiner's allocated students.
  const allocSnap = await allocationsRef(batchId).get();
  const othersIds = new Set();
  let myAlloc = null;
  allocSnap.forEach((d) => {
    if (d.id === examinerId) myAlloc = d.data();
    else (d.data().studentIds || []).forEach((id) => othersIds.add(id));
  });
  const students = allStudents.filter((s) => !othersIds.has(s.id));
  summary.totalStudents = students.length;
  summary.pendingCount = students.filter((s) => s.testStatus === 'pending').length;

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
    batch: summary,
    capacity: buildCapacityView(batchDoc.data(), myAlloc)
  });
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(handler)));
