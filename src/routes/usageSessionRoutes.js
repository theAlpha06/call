const express = require('express');
const { bulkUpload, list, listByDate, dailySummary } = require('../controllers/usageSessionController');

const router = express.Router();

router.post('/sessions/bulk', bulkUpload);
router.get('/sessions', list);
router.get('/sessions/:date', listByDate);
router.get('/daily-summary', dailySummary);

module.exports = router;
