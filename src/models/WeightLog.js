const mongoose = require('mongoose');
const { formatDateString, normalizeDateOnly } = require('../utils/dateUtils');

const weightLogSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    weight: {
      type: Number,
      required: [true, 'Weight value is required'],
      min: [20, 'Weight must be at least 20 kg / lbs'],
      max: [500, 'Weight cannot exceed 500 kg / lbs']
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    },
    date: {
      type: Date,
      required: [true, 'Log date is required'],
      default: () => normalizeDateOnly(new Date())
    },
    dateString: {
      type: String,
      required: [true, 'Date string is required'],
      default: () => formatDateString(new Date())
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters'],
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

weightLogSchema.index({ member: 1, date: -1 });
weightLogSchema.index({ member: 1, dateString: 1 });

const WeightLog = mongoose.model('WeightLog', weightLogSchema);

module.exports = WeightLog;
