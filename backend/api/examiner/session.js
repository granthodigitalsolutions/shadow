const { allowCors } = require('../../src/middleware/withCors');
const { withErrorHandler } = require('../../src/middleware/withErrorHandler');
const { verifyExaminerToken } = require('../../src/middleware/verifyExaminerToken');
const { ValidationError } = require('../../src/utils/errors');

// One serverless function for the examiner session actions (allocate slots,
// remove a student, start the examination). They are separate modules under
// src/handlers; this file only dispatches, so the project stays within the
// Vercel plan's serverless-function limit. vercel.json rewrites the original
// /api/examiner/<action> URLs here with ?action=<action>.
const actions = {
  allocate: require('../../src/handlers/examiner-allocate').handler,
  'remove-student': require('../../src/handlers/examiner-remove-student').handler,
  'start-exam': require('../../src/handlers/examiner-start-exam').handler,
  recover: require('../../src/handlers/examiner-recover').handler,
};

const dispatch = (req, res) => {
  const action = String((req.query && req.query.action) || '');
  const run = Object.prototype.hasOwnProperty.call(actions, action) ? actions[action] : null;
  if (!run) throw new ValidationError('Unknown examiner action.');
  return run(req, res);
};

module.exports = allowCors(withErrorHandler(verifyExaminerToken(dispatch)));
