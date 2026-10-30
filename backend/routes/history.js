const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const { validateObjectIdParam } = require('../middleware/validate');

// GET /api/history - Get recent analyses
router.get('/', async (req, res) => {
  try {
    const { customerId, analysisType, limit } = req.query;
    
    let query = {};
    if (customerId) query.customerId = customerId;
    if (analysisType && analysisType !== 'All') query.analysisType = analysisType;

    let mongoQuery = Analysis.find(query).sort({ createdAt: -1 });
    
    const parsedLimit = parseInt(limit, 10);
    mongoQuery = mongoQuery.limit(Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 500);

    const analyses = await mongoQuery.exec();
    res.json({ success: true, data: analyses });
  } catch (error) {
    console.error("History Route Error (GET /):", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve analysis history.' });
  }
});

// GET /api/history/:id - Get specific analysis detail
router.get('/:id', validateObjectIdParam(), async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("History Route Error (GET /:id):", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve analysis details.' });
  }
});

// DELETE /api/history/:id - Delete analysis (optional/if needed)
router.delete('/:id', validateObjectIdParam(), async (req, res) => {
  try {
    const result = await Analysis.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }
    res.json({ success: true, message: 'Analysis deleted.' });
  } catch (error) {
    console.error("History Route Error (DELETE /:id):", error);
    res.status(500).json({ success: false, message: 'Failed to delete analysis.' });
  }
});

module.exports = router;
