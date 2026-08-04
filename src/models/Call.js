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
    contactName: {
      type: String,
      default: null
    },
    deviceId: {
      type: String,
      required: true,
      index: true
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

// androidCallId (CallLog._ID) is only unique *within a single device* - if
// this backend ever aggregates more than one phone for the same user,
// deviceId has to be part of the key or two devices' call #152 would look
// like the same call and one would be silently dropped as a "duplicate".
callSchema.index({ userId: 1, deviceId: 1, androidCallId: 1 }, { unique: true });

module.exports = mongoose.model('Call', callSchema);
