const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken, getExaminer } = require('../../src/middleware/verifyExaminerToken');
const { db } = require('../../src/config/firebase');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require('../../src/utils/errors');
const { allocationsRef } = require('../../src/utils/examinerBatch');
const logger = require('../../src/utils/logger');

// Same QR payload convention already used by the admin QR Scanner
// (QRScanner.tsx): either the raw student document ID, or a JSON blob with
// an `id`/`studentId` field. Parsed the same way here so both tools stay
// compatible with whatever QR codes are already printed — no new QR format.
const parseStudentId = (raw) => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && (parsed.id || parsed.studentId)) {
      return String(parsed.id || parsed.studentId).trim();
    }
  } catch (_) {
    // Not JSON — treat the whole scanned value as the raw student ID.
  }
  return trimmed;
};

// Dynamic Student Assignment: a batch generated via "Generate Batch" starts
// with empty badge slots (studentIds: []) sized to maxSize. This endpoint is
// the only thing that ever fills them — called once per scanned student QR,
// inside one Firestore transaction so two near-simultaneous scans (of the
// same student, or racing for the last open slot) can never both succeed.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { batchId, examinerId } = getExaminer(req);
  const studentId = parseStudentId(req.body?.qrValue ?? req.body?.studentId);

  if (!studentId) {
    throw new ValidationError('A student QR code or ID is required.');
  }

  const batchRef = db.collection('batches').doc(batchId);
  const studentRef = db.collection('students').doc(studentId);
  const allocRef = allocationsRef(batchId).doc(examinerId);

  const assignedStudent = await db.runTransaction(async (tx) => {
    const [batchSnap, studentSnap, allocSnap] = await Promise.all([tx.get(batchRef), tx.get(studentRef), tx.get(allocRef)]);

    if (!batchSnap.exists) {
      throw new NotFoundError('This batch no longer exists.');
    }
    if (!studentSnap.exists) {
      throw new NotFoundError('Student not found.');
    }

    const batch = batchSnap.data();
    const student = studentSnap.data();
    const studentIds = Array.isArray(batch.studentIds) ? batch.studentIds : [];

    // Duplicate scan within this same session — not an error, just a no-op
    // with a clear message (checked before "already examined" so re-scanning
    // a student this examiner already finished still reads as "duplicate",
    // not a confusing re-statement of their result).
    if (studentIds.includes(studentId)) {
      throw new ConflictError('Student already added to this session.');
    }

    if (student.testStatus && student.testStatus !== 'pending') {
      throw new ConflictError('Student has already been examined.');
    }

    // Eligibility mirrors filterEligibleStudents()
    // (frontend/src/app/utils/batchEligibility.ts): correct school (or
    // individual), same belt test, same belt/stage, payment verified, and
    // not already assigned to this or any other batch.
    const isIndividualBatch = batch.schoolId === 'individual';
    const schoolMatches = isIndividualBatch
      ? student.registrationType === 'individual'
      : student.schoolId === batch.schoolId;
    const studentBelt = student.beltLevel || (student.stageLevel != null ? String(student.stageLevel) : undefined);
    const beltMatches = !batch.belt || studentBelt === batch.belt;
    const eligible =
      schoolMatches &&
      student.beltTestId === batch.beltTestId &&
      beltMatches &&
      student.paymentStatus === 'verified' &&
      !student.batchId;

    if (!eligible) {
      throw new ForbiddenError('Student is not eligible for this batch.');
    }

    // Students can only be added into slots this examiner has reserved.
    const alloc = allocSnap.exists ? allocSnap.data() : null;
    const myIds = alloc && Array.isArray(alloc.studentIds) ? alloc.studentIds : [];
    if (!alloc || !alloc.quantity) {
      throw new ForbiddenError('Allocate slots for yourself first, then add students.');
    }
    if (myIds.length >= alloc.quantity) {
      throw new ConflictError(`All ${alloc.quantity} of your allocated slots are used. Allocate more slots to add another student.`);
    }

    if (studentIds.length >= batch.maxSize) {
      throw new ValidationError('This batch is full — every badge slot already has a student.');
    }

    const now = new Date().toISOString();
    const nextStudentIds = [...studentIds, studentId];
    // Same filling/ongoing transition addStudentToBatch() already uses.
    const newStatus = nextStudentIds.length >= batch.maxSize ? 'ongoing' : 'filling';

    tx.update(batchRef, {
      studentIds: nextStudentIds,
      status: newStatus,
      allocatedAssigned: (batch.allocatedAssigned || 0) + 1,
      updatedAt: now,
    });
    tx.update(allocRef, {
      studentIds: [...myIds, studentId],
      updatedAt: now,
    });
    tx.update(studentRef, {
      batchId,
      scannedAt: now,
      updatedAt: now,
    });

    return {
      id: studentId,
      name: student.name,
      gender: student.gender,
      school: student.school,
      beltLevel: student.beltLevel ?? null,
      beltIndex: student.beltIndex ?? null,
      stageLevel: student.stageLevel ?? null,
      programType: student.programType,
      testStatus: student.testStatus,
    };
  });

  logger.info('Examiner scanned and assigned student to batch', {
    batchId,
    studentId,
    correlationId: req.correlationId,
  });

  res.status(200).json({ success: true, student: assignedStudent });
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(handler)));
