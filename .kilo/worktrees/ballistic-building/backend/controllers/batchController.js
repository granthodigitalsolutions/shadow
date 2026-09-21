const { refreshBatchSummary } = require('../services/batchSummaryService');
const { verifyBatch } = require('../services/batchVerificationService');
const { db } = require('../config/firebaseAdmin');

exports.refreshPdfStatus = async (req, res) => {
  const { batchId } = req.params;
  try {
    const summary = await refreshBatchSummary(batchId);
    res.json({ success: true, summary });
  } catch (error) {
    console.error(`Error refreshing batch summary for ${batchId}:`, error);
    if (error.message.includes('not found')) {
      res.status(404).json({ success: false, code: "BATCH_NOT_FOUND", message: error.message });
    } else {
      res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: 'Internal server error' });
    }
  }
};

exports.verifyBatch = async (req, res) => {
  const { batchId } = req.params;
  try {
    const result = await verifyBatch(batchId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`Error verifying batch ${batchId}:`, error);
    if (error.message.includes('not found')) {
      res.status(404).json({ success: false, code: "BATCH_NOT_FOUND", message: error.message });
    } else {
      res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: 'Internal server error during verification' });
    }
  }
};

exports.lockPdfGeneration = async (req, res) => {
  const { batchId } = req.params;
  try {
    const batchRef = db.collection('batches').doc(batchId);
    const batchSnap = await batchRef.get();
    
    if (!batchSnap.exists) {
      return res.status(404).json({ success: false, code: "BATCH_NOT_FOUND", message: 'Batch not found' });
    }
    
    const batchData = batchSnap.data();
    
    if (batchData.batchPdfStatus === 'generating') {
      return res.status(409).json({ success: false, code: "PDF_GENERATION_LOCKED", message: 'PDF generation is already running for this batch.' });
    }
    
    await batchRef.update({
      batchPdfStatus: 'generating'
    });
    
    res.json({ success: true, message: 'PDF generation locked successfully.' });
  } catch (error) {
    console.error(`Error locking PDF generation for batch ${batchId}:`, error);
    res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: 'Internal server error while locking PDF generation' });
  }
};
