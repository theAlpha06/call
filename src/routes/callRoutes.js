const express = require('express');
const { bulkUpload } = require('../controllers/callController');

const router = express.Router();

router.post('/bulk', bulkUpload);

module.exports = router;
