const { db } = require('../config/firebaseAdmin');

/**
 * Recalculates and updates the batch PDF status based on the actual student records.
 * 
 * @param {string} batchId - The ID of the batch to refresh.
 * @returns {Promise<Object>} The summary of the refresh operation.
 */
async function refreshBatchPdfStatus(batchId) {
  if (!batchId) throw new Error("batchId is required");

  // Load the batch to ensure it exists
  const batchRef = db.collection('batches').doc(batchId);
  const batchSnap = await batchRef.get();
  
  if (!batchSnap.exists) {
    throw new Error(`Batch ${batchId} not found`);
  }

  // Load all students for this batch
  const studentsSnap = await db.collection('students').where('batchId', '==', batchId).get();
  
  const totalStudents = studentsSnap.size;
  let readyStudents = 0;
  let failedStudents = 0;
  let pendingStudents = 0;

  if (totalStudents === 0) {
    // Empty batch
    const status = "idle";
    await batchRef.update({ batchPdfStatus: status });
    return { status, totalStudents: 0, readyStudents: 0, failedStudents: 0, pendingStudents: 0 };
  }

  studentsSnap.forEach((doc) => {
    const data = doc.data();
    
    // Condition 1: Failed
    if (data.pdfUploadStatus === "failed" || data.pdfUploadError) {
      failedStudents++;
    } 
    // Condition 2: Ready
    else if (data.resultPdfUrl && data.resultPdfUrl.trim() !== "") {
      readyStudents++;
    } 
    // Condition 3: Pending
    else {
      pendingStudents++;
    }
  });

  let status = "generating"; // Default to generating if in-progress

  if (readyStudents === totalStudents && totalStudents > 0) {
    status = "completed";
  } else if (failedStudents > 0) {
    status = "failed";
  } else if (pendingStudents === totalStudents) {
    status = "idle"; // None generated yet
  }

  // Update only the cached batch fields
  await batchRef.update({
    batchPdfStatus: status,
    lastPdfStatusRefresh: new Date().toISOString()
  });

  return {
    status,
    totalStudents,
    readyStudents,
    failedStudents,
    pendingStudents
  };
}

module.exports = {
  refreshBatchPdfStatus
};
