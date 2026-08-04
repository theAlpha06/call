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

/**
 * GET /api/usage?page=1&limit=50&date=YYYY-MM-DD
 * Lists the daily per-app aggregate rows (distinct from the detailed
 * session timeline, which lives under /api/usage/sessions).
 */
async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const filter = { userId: DEFAULT_USER_ID };
    if (req.query.date) filter.date = req.query.date;

    const [items, total] = await Promise.all([
      Usage.find(filter).sort({ date: -1, usageMinutes: -1 }).skip(skip).limit(limit).lean(),
      Usage.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUpload, list };
