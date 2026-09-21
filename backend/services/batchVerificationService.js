const { db } = require('../config/firebaseAdmin');
const { refreshBatchSummary } = require('./batchSummaryService');

/**
 * Validates a batch and its students to ensure they are ready for WhatsApp delivery.
 * 
 * @param {string} batchId 
 * @returns {Promise<Object>} Verification results with readiness state, warnings, and errors.
 */
async function verifyBatch(batchId) {
  if (!batchId) throw new Error("batchId is required");

  // First, always refresh the summary to ensure we are looking at the latest truth
  const summaryUpdates = await refreshBatchSummary(batchId);
  const summaryCache = summaryUpdates.summaryCache;

  const warnings = [];
  const errors = [];

  if (summaryCache.totalStudents === 0) {
    errors.push("Batch has no students.");
  }

  if (summaryCache.pdf.failed > 0) {
    errors.push(`${summaryCache.pdf.failed} student(s) failed to generate PDF.`);
  }
  
  if (summaryCache.pdf.pending > 0) {
    errors.push(`${summaryCache.pdf.pending} student(s) are missing result PDFs.`);
  }

  if (summaryCache.scores.pending > 0) {
    errors.push(`${summaryCache.scores.pending} student(s) have not completed scoring.`);
  }

  if (summaryCache.whatsapp.missingNumber > 0) {
    warnings.push(`${summaryCache.whatsapp.missingNumber} student(s) have no WhatsApp number and will be skipped.`);
  }

  const scoresReady = summaryCache.scores.pending === 0 && summaryCache.totalStudents > 0;
  const pdfReady = summaryCache.pdf.pending === 0 && summaryCache.pdf.failed === 0 && summaryCache.totalStudents > 0;
  const whatsappReady = summaryCache.totalStudents > 0 && summaryCache.whatsapp.missingNumber < summaryCache.totalStudents;
  
  const canSend = errors.length === 0 && whatsappReady;

  const readiness = {
    scoresReady,
    pdfReady,
    whatsappReady,
    readyToSend: canSend
  };

  // Update batch document with readiness state for the UI
  await db.collection('batches').doc(batchId).update({
    batchReadiness: readiness
  });

  return {
    canSend,
    summary: summaryCache,
    warnings,
    errors,
    readiness
  };
}

module.exports = {
  verifyBatch
};
