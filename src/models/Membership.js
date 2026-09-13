const mongoose = require('mongoose');
const { MEMBERSHIP_STATUS, PAYMENT_STATUS } = require('../constants/status');
const { daysRemaining, formatDateString } = require('../utils/dateUtils');
const { EXPIRING_SOON_THRESHOLD_DAYS } = require('../config/environment');

const membershipSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: [true, 'Plan reference is required'],
      index: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true
    },
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.ACTIVE,
      index: true
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PAID
    },
    amountPaid: {
      type: Number,
      min: [0, 'Amount paid cannot be negative'],
      default: 0
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

membershipSchema.index({ member: 1, endDate: -1 });
membershipSchema.index({ status: 1, endDate: 1 });
membershipSchema.index({ member: 1, status: 1, startDate: 1, endDate: -1 });

membershipSchema.virtual('derivedStatus').get(function () {
  if (this.status === MEMBERSHIP_STATUS.CANCELLED) {
    return MEMBERSHIP_STATUS.CANCELLED;
  }
  const remaining = daysRemaining(this.endDate);
  if (remaining < 0) {
    return MEMBERSHIP_STATUS.EXPIRED;
  }
  if (remaining <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return MEMBERSHIP_STATUS.EXPIRING_SOON;
  }
  return MEMBERSHIP_STATUS.ACTIVE;
});

membershipSchema.virtual('daysRemainingCount').get(function () {
  return daysRemaining(this.endDate);
});

membershipSchema.methods.syncDerivedStatus = function () {
  const currentDerived = this.derivedStatus;
  if (this.status !== currentDerived && this.status !== MEMBERSHIP_STATUS.CANCELLED) {
    this.status = currentDerived;
  }
  return this.status;
};

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
