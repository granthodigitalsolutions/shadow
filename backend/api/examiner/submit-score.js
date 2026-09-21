const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken } = require('../../src/middleware/verifyExaminerToken');
const { db } = require('../../src/config/firebase');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../src/utils/errors');
const logger = require('../../src/utils/logger');

// Max points per scoring category (technical / athletic).
const MAX_CATEGORY_SCORE = 50;

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId } = req.examiner;
  const {
    studentId,
    technicalScore,
    athleticScore,
    scoringResults,
    subCategoryResults,
    percentage,
    result,
    examinerRemarks,
    lessonNumbers
  } = req.body;

  if (typeof studentId !== 'string' || studentId.trim().length === 0) {
    throw new ValidationError('studentId is required');
  }

  if (typeof technicalScore !== 'number' || Number.isNaN(technicalScore) || technicalScore < 0 || technicalScore > MAX_CATEGORY_SCORE) {
    throw new ValidationError('technicalScore must be a number between 0 and 50');
  }

  if (typeof athleticScore !== 'number' || Number.isNaN(athleticScore) || athleticScore < 0 || athleticScore > MAX_CATEGORY_SCORE) {
    throw new ValidationError('athleticScore must be a number between 0 and 50');
  }

  if (result !== 'passed' && result !== 'failed') {
    throw new ValidationError("result must be either 'passed' or 'failed'");
  }

  const batchRef = db.collection('batches').doc(batchId);
  const batchDoc = await batchRef.get();

  if (!batchDoc.exists) {
    throw new NotFoundError('This batch no longer exists.');
  }

  const batch = batchDoc.data();
  const studentIds = Array.isArray(batch.studentIds) ? batch.studentIds : [];

  if (!studentIds.includes(studentId)) {
    throw new ForbiddenError('This student is not part of your verified batch.');
  }

  await db.runTransaction(async (tx) => {
    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await tx.get(studentRef);

    if (!studentSnap.exists) {
      throw new NotFoundError('Student not found.');
    }

    if (studentSnap.data().testStatus !== 'pending') {
      throw new ConflictError('This student has already been scored.');
    }

    const now = new Date().toISOString();
    tx.update(studentRef, {
      score: technicalScore + athleticScore,
      percentage,
      result: result,
      testStatus: result,
      scoringResults,
      subCategoryResults,
      ranking: null,
      examinerRemarks: examinerRemarks ?? null,
      scoredAt: now,
      updatedAt: now
    });
  });

  logger.info('Examiner submitted student score', {
    batchId,
    studentId,
    result,
    lessonNumbers,
    correlationId: req.correlationId
  });

  res.status(200).json({
    success: true,
    student: {
      id: studentId,
      testStatus: result,
      percentage,
      result
    }
  });
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(handler)));
