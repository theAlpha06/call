const mongoose = require('mongoose');

const appUsageSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    packageName: {
      type: String,
      required: true
    },
    appName: {
      type: String,
      required: true
    },
    date: {
      type: String, // yyyy-MM-dd, the LOCAL calendar date the session started on
      required: true,
      index: true
    },
    sessionStart: {
      type: Number, // epoch millis
      required: true
    },
    sessionEnd: {
      type: Number, // epoch millis
      required: true
    },
    duration: {
      type: Number, // seconds
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

// A session is uniquely identified by (user, app, exact start time). The
// Android client only ever writes a session once it has a confirmed end
// time, and sessionStart is derived from a monotonic UsageEvents timestamp,
// so this is a safe idempotency key for retried bulk uploads.
appUsageSessionSchema.index(
  { userId: 1, packageName: 1, sessionStart: 1 },
  { unique: true }
);

// Supports the common dashboard query: "all sessions for this user on this date"
appUsageSessionSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('AppUsageSession', appUsageSessionSchema);
