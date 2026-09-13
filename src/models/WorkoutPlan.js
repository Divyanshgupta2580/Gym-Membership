const mongoose = require('mongoose');
const { DAYS_OF_WEEK, DIFFICULTY_LEVELS } = require('../constants/status');

const exerciseEntrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exercise name is required'],
      trim: true
    },
    sets: {
      type: Number,
      required: [true, 'Sets count is required'],
      min: [1, 'Sets must be at least 1']
    },
    reps: {
      type: String,
      required: [true, 'Reps specification is required'],
      trim: true
    },
    restSeconds: {
      type: Number,
      min: [0, 'Rest cannot be negative'],
      default: 60
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    order: {
      type: Number,
      default: 1
    }
  },
  { _id: true }
);

const dailyScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: [true, 'Day of week is required']
    },
    isRestDay: {
      type: Boolean,
      default: false
    },
    focus: {
      type: String,
      trim: true,
      default: 'General Workout'
    },
    exercises: {
      type: [exerciseEntrySchema],
      default: []
    }
  },
  { _id: true }
);

const workoutPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workout plan name is required'],
      trim: true,
      maxlength: [100, 'Plan name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required'],
      index: true
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Trainer reference is required'],
      index: true
    },
    difficulty: {
      type: String,
      enum: DIFFICULTY_LEVELS,
      default: 'Intermediate'
    },
    schedule: {
      type: [dailyScheduleSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

workoutPlanSchema.index({ member: 1, isActive: 1 });
workoutPlanSchema.index({ trainer: 1, createdAt: -1 });

const WorkoutPlan = mongoose.model('WorkoutPlan', workoutPlanSchema);

module.exports = WorkoutPlan;
