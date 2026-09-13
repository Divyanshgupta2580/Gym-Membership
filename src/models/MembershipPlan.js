const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      unique: true,
      trim: true,
      maxlength: [80, 'Plan name cannot exceed 80 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: ''
    },
    durationInDays: {
      type: Number,
      required: [true, 'Plan duration in days is required'],
      min: [1, 'Duration must be at least 1 day']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      uppercase: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    features: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

membershipPlanSchema.virtual('durationMonths').get(function () {
  return (this.durationInDays / 30).toFixed(1);
});

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);

module.exports = MembershipPlan;
