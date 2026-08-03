const express = require('express');
const { bulkUpload } = require('../controllers/usageController');

const router = express.Router();

router.post('/bulk', bulkUpload);

module.exports = router;
