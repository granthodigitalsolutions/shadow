const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');

// Verification endpoint before WhatsApp delivery
router.get('/:batchId/verify', batchController.verifyBatch);

// Manual PDF status refresh endpoint
router.post('/:batchId/refresh-pdf-status', batchController.refreshPdfStatus);

// Lock PDF generation endpoint
router.post('/:batchId/lock-pdf-generation', batchController.lockPdfGeneration);

module.exports = router;
