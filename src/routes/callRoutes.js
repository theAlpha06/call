const express = require('express');
const { bulkUpload, list } = require('../controllers/callController');

const router = express.Router();

router.post('/bulk', bulkUpload);
router.get('/', list);

module.exports = router;
