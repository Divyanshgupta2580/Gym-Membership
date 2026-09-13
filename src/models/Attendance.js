const mongoose = require('mongoose');
const { formatDateString, normalizeDateOnly } = require('../utils/dateUtils');

const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
      default: () => normalizeDateOnly(new Date())
    },
    dateString: {
      type: String,
      required: [true, 'Attendance date string is required'],
      default: () => formatDateString(new Date())
    },
    checkInTime: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['web_checkin', 'admin_override', 'kiosk'],
      default: 'web_checkin'
    },
    notes: {
      type: String,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Guarantee absolute uniqueness per member per day at database level
attendanceSchema.index({ member: 1, dateString: 1 }, { unique: true });
attendanceSchema.index({ dateString: 1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ checkInTime: -1 });
attendanceSchema.index({ dateString: 1, checkInTime: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
