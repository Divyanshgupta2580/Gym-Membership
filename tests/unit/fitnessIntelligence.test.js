const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const WeightLog = require('../../src/models/WeightLog');
const WorkoutPlan = require('../../src/models/WorkoutPlan');
const fitnessIntelligenceService = require('../../src/services/fitnessIntelligenceService');
const { formatDateString, addDays } = require('../../src/utils/dateUtils');
const { ROLES } = require('../../src/constants/roles');

describe('GYMFLOW Fitness Intelligence Engine', () => {
  let member;
  let trainer;

  beforeEach(async () => {
    trainer = await User.create({
      firstName: 'Coach',
      lastName: 'Marcus',
      email: 'marcus@gymflow.test',
      passwordHash: 'hash',
      role: ROLES.TRAINER
    });

    member = await User.create({
      firstName: 'Test',
      lastName: 'Athlete',
      email: 'athlete@gymflow.test',
      passwordHash: 'hash',
      role: ROLES.MEMBER,
      assignedTrainer: trainer._id
    });
  });

  test('handles zero data gracefully without inventing false statistics', async () => {
    const intelligence = await fitnessIntelligenceService.getMemberIntelligence(member._id);

    expect(intelligence.attendance.total).toBe(0);
    expect(intelligence.attendance.currentStreak).toBe(0);
    expect(intelligence.weight.hasData).toBe(false);
    expect(intelligence.workoutAdherence.hasPlan).toBe(false);
    expect(intelligence.narrativeSummary).toContain('No attendance sessions have been logged yet');
  });

  test('detects improving attendance consistency between 14-day windows', async () => {
    const now = new Date();

    // 5 check-ins in the last 14 days
    const recentDays = [0, 2, 4, 7, 10];
    for (const d of recentDays) {
      const date = addDays(now, -d);
      await Attendance.create({
        member: member._id,
        date,
        dateString: formatDateString(date),
        checkInTime: date
      });
    }

    // Only 1 check-in in the prior 14 days (15 to 28 days ago)
    const priorDate = addDays(now, -20);
    await Attendance.create({
      member: member._id,
      date: priorDate,
      dateString: formatDateString(priorDate),
      checkInTime: priorDate
    });

    const intelligence = await fitnessIntelligenceService.getMemberIntelligence(member._id);

    expect(intelligence.attendance.total).toBe(6);
    expect(intelligence.attendance.last14DaysCount).toBe(5);
    expect(intelligence.attendance.prior14DaysCount).toBe(1);
    expect(intelligence.attendance.consistencyTrend).toBe('improving');
    expect(intelligence.narrativeSummary).toContain('attendance consistency has improved');
  });

  test('accurately calculates weight trajectory, net change, and rate per week', async () => {
    const now = new Date();

    // Log weight 28 days ago: 80.0 kg
    await WeightLog.create({
      member: member._id,
      weight: 80.0,
      unit: 'kg',
      date: addDays(now, -28),
      dateString: formatDateString(addDays(now, -28))
    });

    // Log weight today: 78.0 kg (net change -2.0 kg over 4 weeks -> ~ -0.5 kg/week)
    await WeightLog.create({
      member: member._id,
      weight: 78.0,
      unit: 'kg',
      date: now,
      dateString: formatDateString(now)
    });

    const intelligence = await fitnessIntelligenceService.getMemberIntelligence(member._id);

    expect(intelligence.weight.hasData).toBe(true);
    expect(intelligence.weight.firstWeight).toBe(80.0);
    expect(intelligence.weight.latestWeight).toBe(78.0);
    expect(intelligence.weight.netChange).toBe(-2.0);
    expect(intelligence.weight.trajectory).toBe('decreasing');
    expect(intelligence.weight.ratePerWeek).toBeLessThan(0);
    expect(intelligence.narrativeSummary).toContain('-2 kg');
  });

  test('computes workout adherence against planned workout days in active plan', async () => {
    const now = new Date();

    // Create 4-day workout plan
    await WorkoutPlan.create({
      name: 'Split 4-Day',
      member: member._id,
      trainer: trainer._id,
      isActive: true,
      schedule: [
        { dayOfWeek: 'Monday', isRestDay: false, exercises: [{ name: 'Squat', sets: 3, reps: '10' }] },
        { dayOfWeek: 'Tuesday', isRestDay: false, exercises: [{ name: 'Bench', sets: 3, reps: '10' }] },
        { dayOfWeek: 'Thursday', isRestDay: false, exercises: [{ name: 'Deadlift', sets: 3, reps: '10' }] },
        { dayOfWeek: 'Friday', isRestDay: false, exercises: [{ name: 'Press', sets: 3, reps: '10' }] },
        { dayOfWeek: 'Wednesday', isRestDay: true, exercises: [] },
        { dayOfWeek: 'Saturday', isRestDay: true, exercises: [] },
        { dayOfWeek: 'Sunday', isRestDay: true, exercises: [] }
      ]
    });

    // Check in 2 times in the last 7 days -> 2/4 = 50% adherence
    const checkIns = [1, 3];
    for (const offset of checkIns) {
      const date = addDays(now, -offset);
      await Attendance.create({
        member: member._id,
        date,
        dateString: formatDateString(date),
        checkInTime: date
      });
    }

    const intelligence = await fitnessIntelligenceService.getMemberIntelligence(member._id);

    expect(intelligence.workoutAdherence.hasPlan).toBe(true);
    expect(intelligence.workoutAdherence.plannedDaysPerWeek).toBe(4);
    expect(intelligence.workoutAdherence.adherenceRate).toBe(50);
  });
});
