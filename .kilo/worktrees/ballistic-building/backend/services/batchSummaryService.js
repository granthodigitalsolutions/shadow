const { db } = require('../config/firebaseAdmin');

/**
 * Rebuilds all cached counters and summaries for a batch strictly from the student documents (Source of Truth).
 * 
 * @param {string} batchId 
 * @returns {Promise<Object>} The rebuilt summary
 */
async function refreshBatchSummary(batchId) {
  if (!batchId) throw new Error("batchId is required");

  const batchRef = db.collection('batches').doc(batchId);
  const batchSnap = await batchRef.get();

  if (!batchSnap.exists) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const studentsSnap = await db.collection('students').where('batchId', '==', batchId).get();
  
  let summary = {
    totalStudents: studentsSnap.size,
    pdf: {
      ready: 0,
      failed: 0,
      pending: 0,
    },
    whatsapp: {
      sent: 0,
      failed: 0,
      pending: 0,
      delivered: 0,
      read: 0,
      missingNumber: 0
    },
    scores: {
      completed: 0,
      pending: 0
    }
  };

  if (summary.totalStudents === 0) {
    const emptyStatus = {
      batchPdfStatus: "idle",
      resultsSent: false,
      whatsappStatus: "idle",
      lastSummaryRefresh: new Date().toISOString(),
      summaryCache: summary
    };
    await batchRef.update(emptyStatus);
    return emptyStatus;
  }

  studentsSnap.forEach((doc) => {
    const data = doc.data();

    // 1. PDF Metrics
    if (data.pdfUploadStatus === "failed" || data.pdfUploadError) {
      summary.pdf.failed++;
    } else if (data.resultPdfUrl && data.resultPdfUrl.trim() !== "") {
      summary.pdf.ready++;
    } else {
      summary.pdf.pending++;
    }

    // 2. WhatsApp Metrics
    const phone = data.parentWhatsapp || data.whatsapp || data.whatsappNumber || data.phone || data.mobile || "";
    if (!phone || phone.trim() === "") {
      summary.whatsapp.missingNumber++;
    }

    if (data.whatsappStatus === 'sent') summary.whatsapp.sent++;
    else if (data.whatsappStatus === 'failed') summary.whatsapp.failed++;
    else if (data.whatsappStatus === 'delivered') summary.whatsapp.delivered++;
    else if (data.whatsappStatus === 'read') summary.whatsapp.read++;
    else summary.whatsapp.pending++;

    // 3. Score Metrics
    if (data.testStatus === "passed" || data.testStatus === "failed" || data.testStatus === "completed") {
      summary.scores.completed++;
    } else {
      summary.scores.pending++;
    }
  });

  // Calculate Batch Derived Statuses
  let batchPdfStatus = "generating";
  if (summary.pdf.ready === summary.totalStudents) batchPdfStatus = "completed";
  else if (summary.pdf.failed > 0) batchPdfStatus = "failed";
  else if (summary.pdf.pending === summary.totalStudents) batchPdfStatus = "idle";

  let whatsappStatus = "sending";
  const processedWa = summary.whatsapp.sent + summary.whatsapp.failed + summary.whatsapp.delivered + summary.whatsapp.read;
  if (processedWa === 0) whatsappStatus = "idle";
  else if (processedWa === summary.totalStudents - summary.whatsapp.missingNumber && processedWa > 0) whatsappStatus = "completed";
  
  const resultsSent = processedWa > 0;

  const updates = {
    batchPdfStatus,
    whatsappStatus,
    resultsSent,
    lastSummaryRefresh: new Date().toISOString(),
    summaryCache: summary
  };

  await batchRef.update(updates);

  return updates;
}

module.exports = {
  refreshBatchSummary
};
