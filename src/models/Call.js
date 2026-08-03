const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    androidCallId: {
      type: Number,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    callType: {
      type: String,
      enum: ['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'VOICEMAIL', 'BLOCKED', 'UNKNOWN'],
      required: true
    },
    duration: {
      type: Number,
      required: true,
      min: 0
    },
    timestamp: {
      type: Number, // epoch millis, as sent by the device
      required: true
    }
  },
  { timestamps: true }
);

// This is the server-side duplicate guard mirroring the client's Room
// UNIQUE index: the same physical call, identified by the device's
// CallLog._ID, must never be stored twice for the same user. Re-uploads
// (e.g. after a client retry following a network blip) become no-ops here.
callSchema.index({ userId: 1, androidCallId: 1 }, { unique: true });

module.exports = mongoose.model('Call', callSchema);
