const AppUsageSession = require('../models/AppUsageSession');
const logger = require('../config/logger');

const DEFAULT_USER_ID = 'default-user';
const MAX_PAGE_SIZE = 200;

/**
 * POST /api/usage/sessions/bulk
 *
 * Per-item insert, relying on the (userId, packageName, sessionStart) unique
 * index to make retried uploads idempotent - identical to the pattern used
 * for calls.
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
      const { packageName, appName, date, sessionStart, sessionEnd, duration } = record;

      if (
        !packageName || !date ||
        sessionStart === undefined || sessionEnd === undefined || duration === undefined
      ) {
        errors.push({ packageName, sessionStart, reason: 'Missing required field(s)' });
        continue;
      }

      try {
        await AppUsageSession.create({
          userId: DEFAULT_USER_ID,
          packageName,
          appName: appName || packageName,
          date,
          sessionStart,
          sessionEnd,
          duration
        });
        inserted++;
      } catch (err) {
        if (err.code === 11000) {
          duplicates++;
        } else {
          logger.error('Failed to insert usage session', { error: err.message, packageName, sessionStart });
          errors.push({ packageName, sessionStart, reason: 'Database error' });
        }
      }
    }

    return res.json({ success: true, inserted, duplicates, errors });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/usage/sessions?page=1&limit=50&date=YYYY-MM-DD&packageName=...
 *
 * General-purpose paginated listing, filterable by date and/or package.
 */
async function list(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    const filter = { userId: DEFAULT_USER_ID };
    if (req.query.date) filter.date = req.query.date;
    if (req.query.packageName) filter.packageName = req.query.packageName;

    const [items, total] = await Promise.all([
      AppUsageSession.find(filter).sort({ sessionStart: -1 }).skip(skip).limit(limit).lean(),
      AppUsageSession.countDocuments(filter)
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

/**
 * GET /api/usage/sessions/:date
 *
 * All sessions for a single day, grouped by app, with per-app rollups
 * (first open, last close, session count, total duration) computed
 * server-side so the dashboard doesn't have to.
 */
async function listByDate(req, res, next) {
  try {
    const { date } = req.params;

    const sessions = await AppUsageSession.find({ userId: DEFAULT_USER_ID, date })
      .sort({ sessionStart: 1 })
      .lean();

    const byApp = new Map();
    for (const s of sessions) {
      if (!byApp.has(s.packageName)) {
        byApp.set(s.packageName, {
          packageName: s.packageName,
          appName: s.appName,
          sessions: [],
          totalDuration: 0,
          firstOpen: s.sessionStart,
          lastClose: s.sessionEnd
        });
      }
      const entry = byApp.get(s.packageName);
      entry.sessions.push({
        sessionStart: s.sessionStart,
        sessionEnd: s.sessionEnd,
        duration: s.duration
      });
      entry.totalDuration += s.duration;
      entry.firstOpen = Math.min(entry.firstOpen, s.sessionStart);
      entry.lastClose = Math.max(entry.lastClose, s.sessionEnd);
    }

    const apps = Array.from(byApp.values())
      .map((entry) => ({ ...entry, sessionCount: entry.sessions.length }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    return res.json({ success: true, date, apps });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/usage/daily-summary?days=7
 *
 * Per-day totals (screen time + session count) for the last N days, plus a
 * top-apps breakdown - the numbers the dashboard's summary cards/charts need.
 */
async function dailySummary(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 90);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDateStr = cutoff.toISOString().slice(0, 10);

    const results = await AppUsageSession.aggregate([
      { $match: { userId: DEFAULT_USER_ID, date: { $gte: cutoffDateStr } } },
      {
        $group: {
          _id: '$date',
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 },
          apps: { $addToSet: '$packageName' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalDuration: 1,
          sessionCount: 1,
          appCount: { $size: '$apps' }
        }
      }
    ]);

    const topApps = await AppUsageSession.aggregate([
      { $match: { userId: DEFAULT_USER_ID, date: { $gte: cutoffDateStr } } },
      {
        $group: {
          _id: '$packageName',
          appName: { $first: '$appName' },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { totalDuration: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          packageName: '$_id',
          appName: 1,
          totalDuration: 1,
          sessionCount: 1
        }
      }
    ]);

    return res.json({ success: true, days, daily: results, topApps });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUpload, list, listByDate, dailySummary };
