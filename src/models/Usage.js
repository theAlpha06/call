const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema(
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
    usageMinutes: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: String, // yyyy-MM-dd
      required: true
    }
  },
  { timestamps: true }
);

// One aggregate row per user/app/day; re-uploads overwrite via upsert rather
// than accumulate, since the client already sends the full day's total.
usageSchema.index({ userId: 1, packageName: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Usage', usageSchema);
