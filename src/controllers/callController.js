const Call = require('../models/Call');
const logger = require('../config/logger');

// Single-user/personal-use setup: no auth, everything is tagged with a fixed
// userId so the existing (userId, androidCallId) unique index still works
// exactly the same way to prevent duplicates.
const DEFAULT_USER_ID = 'default-user';

/**
 * POST /api/calls/bulk
 *
 * Accepts an array of call records. Uses per-item insert with the
 * (userId, androidCallId) unique index doing the actual duplicate
 * prevention: if a record was already uploaded (e.g. a client retry after a
 * dropped response), the duplicate key error is caught and counted, not
 * treated as a failure. This keeps the endpoint idempotent, which matters
 * because the Android client will retry a bulk upload whenever it doesn't
 * get a confirmed success response.
 */
async function bulkUpload(req, res, next) {
  try {
    const records = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Request body must be a non-empty array' });
    }

    let inserted = 0;
    let duplicates = 0;
    const errors = [];

    for (const record of records) {
      const { androidCallId, number, contactName, deviceId, type, duration, timestamp } = record;

      if (
        androidCallId === undefined ||
        !number ||
        !deviceId ||
        !type ||
        duration === undefined ||
        timestamp === undefined
      ) {
        errors.push({ androidCallId, reason: 'Missing required field(s)' });
        continue;
      }

      try {
        await Call.create({
          userId: DEFAULT_USER_ID,
          androidCallId,
          phoneNumber: number,
          contactName: contactName || null,
          deviceId,
          callType: type,
          duration,
          timestamp
        });
        inserted++;
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate androidCallId for this user - already synced, ignore.
          duplicates++;
        } else {
          logger.error('Failed to insert call record', { error: err.message, androidCallId });
          errors.push({ androidCallId, reason: 'Database error' });
        }
      }
    }

    return res.json({ success: true, inserted, duplicates, errors });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/calls?page=1&limit=50&type=INCOMING
 */
async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const filter = { userId: DEFAULT_USER_ID };
    if (req.query.type) filter.callType = req.query.type;
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;

    const [items, total] = await Promise.all([
      Call.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Call.countDocuments(filter)
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
