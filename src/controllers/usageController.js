const Usage = require('../models/Usage');
const logger = require('../config/logger');

const DEFAULT_USER_ID = 'default-user';

/**
 * POST /api/usage/bulk
 *
 * Upserts per (userId, packageName, date) since a device may legitimately
 * re-send an updated total for "today" multiple times as the day progresses.
 */
async function bulkUpload(req, res, next) {
  try {
    const records = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Request body must be a non-empty array' });
    }

    let inserted = 0;
    const errors = [];

    for (const record of records) {
      const { packageName, usageMinutes, date } = record;

      if (!packageName || usageMinutes === undefined || !date) {
        errors.push({ packageName, reason: 'Missing required field(s)' });
        continue;
      }

      try {
        await Usage.findOneAndUpdate(
          { userId: DEFAULT_USER_ID, packageName, date },
          { $set: { usageMinutes } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        inserted++;
      } catch (err) {
        logger.error('Failed to upsert usage record', { error: err.message, packageName, date });
        errors.push({ packageName, reason: 'Database error' });
      }
    }

    return res.json({ success: true, inserted, duplicates: 0, errors });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUpload };
