const mongoose = require('mongoose');
const User = require('../src/models/User');
const MembershipPlan = require('../src/models/MembershipPlan');
const Membership = require('../src/models/Membership');
const WorkoutPlan = require('../src/models/WorkoutPlan');
const Attendance = require('../src/models/Attendance');
const WeightLog = require('../src/models/WeightLog');
const AuditLog = require('../src/models/AuditLog');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { ROLES } = require('../src/constants/roles');
const { MEMBERSHIP_STATUS, DAYS_OF_WEEK } = require('../src/constants/status');
const { formatDateString, normalizeDateOnly, addDays } = require('../src/utils/dateUtils');
const logger = require('../src/utils/logger');

async function seed() {
  logger.info('Starting GYMFLOW database seed execution...');

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    logger.error('CRITICAL: Database seeding is blocked in production environment. Set ALLOW_PRODUCTION_SEED=true to explicitly override.');
    process.exit(1);
  }

  try {
    await connectDatabase();

    const dbName = mongoose.connection.name || '';
    if (/(prod|production)/i.test(dbName) && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      logger.error(`CRITICAL: Database seeding blocked on production database '${dbName}'. Set ALLOW_PRODUCTION_SEED=true to explicitly override.`);
      await disconnectDatabase();
      process.exit(1);
    }

    // 1. Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      MembershipPlan.deleteMany({}),
      Membership.deleteMany({}),
      WorkoutPlan.deleteMany({}),
      Attendance.deleteMany({}),
      WeightLog.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    logger.info('Cleaned existing database collections');

    // 2. Seed Membership Plans
    const plansData = [
      {
        name: 'Day Pass',
        description: 'Single-day access to gym facilities and locker amenities.',
        durationInDays: 1,
        price: 15,
        currency: 'USD',
        features: ['Full Gym Floor Access', 'Locker Room & Shower Access']
      },
      {
        name: 'Monthly Basic',
        description: 'Flexible 30-day standard membership for regular training.',
        durationInDays: 30,
        price: 49,
        currency: 'USD',
        features: ['Unlimited Gym Floor Access', 'Cardio & Free Weight Zones', 'Fitness Intelligence Progress Tracking']
      },
      {
        name: 'Quarterly Pro',
        description: '90-day comprehensive training access with coach pairing.',
        durationInDays: 90,
        price: 129,
        currency: 'USD',
        features: ['Unlimited Gym Floor Access', 'Assigned Certified Personal Coach', 'Customized 7-Day Workout Routine', 'Advanced Telemetry & Weight Tracking']
      },
      {
        name: 'Annual Elite',
        description: 'Full 365-day VIP access with priority coaching and assessment.',
        durationInDays: 365,
        price: 449,
        currency: 'USD',
        features: ['365-Day Unlimited Access', 'Priority Personal Trainer Programming', 'Bi-weekly Fitness Intelligence Audit', 'Complimentary Guest Pass per Month', 'Locker & Towel Service']
      }
    ];

    const createdPlans = await MembershipPlan.insertMany(plansData);
    logger.info('Seeded membership plans', { count: createdPlans.length });

    // 3. Create Users
    const sharedPasswordHash = await User.hashPassword('Password123!');

    // Admin Account
    const admin = await User.create({
      firstName: 'Arthur',
      lastName: 'Pendelton',
      email: 'admin@gymflow.test',
      passwordHash: sharedPasswordHash,
      role: ROLES.ADMIN,
      phone: '+1-555-0100',
      isActive: true,
      isDemoAccount: true
    });

    // Trainer Accounts
    const trainerMarcus = await User.create({
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'marcus.trainer@gymflow.test',
      passwordHash: sharedPasswordHash,
      role: ROLES.TRAINER,
      phone: '+1-555-0201',
      trainerSpecialties: ['Hypertrophy', 'Strength Training', 'Powerlifting'],
      bio: 'Certified strength and conditioning specialist with 8 years of competitive coaching experience.',
      isActive: true,
      isDemoAccount: true
    });

    const trainerSarah = await User.create({
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.trainer@gymflow.test',
      passwordHash: sharedPasswordHash,
      role: ROLES.TRAINER,
      phone: '+1-555-0202',
      trainerSpecialties: ['Mobility', 'HIIT', 'Endurance'],
      bio: 'Former collegiate track athlete specializing in functional movement, mobility restoration, and metabolic conditioning.',
      isActive: true
    });

    const trainerDavid = await User.create({
      firstName: 'David',
      lastName: 'Kim',
      email: 'david.trainer@gymflow.test',
      passwordHash: sharedPasswordHash,
      role: ROLES.TRAINER,
      phone: '+1-555-0203',
      trainerSpecialties: ['Body Recomposition', 'Beginner Mechanics'],
      bio: 'Focused on evidence-based hypertrophy and establishing sustainable fitness routines for novices.',
      isActive: true
    });

    logger.info('Seeded staff accounts (Admin and 3 Trainers)');

    // Member Accounts
    const membersData = [
      {
        firstName: 'Alex',
        lastName: 'Mercer',
        email: 'alex.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0301',
        height: 182,
        weight: 80.5,
        role: ROLES.MEMBER,
        assignedTrainer: trainerMarcus._id,
        isDemoAccount: true,
        bio: 'Focused on building lean muscle mass and improving deadlift technique.'
      },
      {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0302',
        role: ROLES.MEMBER,
        assignedTrainer: trainerSarah._id,
        bio: 'Training for half-marathon and cardiovascular endurance.'
      },
      {
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'jordan.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0303',
        role: ROLES.MEMBER,
        assignedTrainer: trainerMarcus._id,
        bio: 'Powerlifting novice aiming for 300lb squat.'
      },
      {
        firstName: 'Maya',
        lastName: 'Lin',
        email: 'maya.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0304',
        role: ROLES.MEMBER,
        assignedTrainer: trainerDavid._id,
        bio: 'Working on core strength, postural alignment, and general wellness.'
      },
      {
        firstName: 'Thomas',
        lastName: 'Wright',
        email: 'thomas.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0305',
        role: ROLES.MEMBER,
        assignedTrainer: null,
        bio: 'Self-guided gym enthusiast.'
      },
      {
        firstName: 'Rachel',
        lastName: 'Green',
        email: 'rachel.member@gymflow.test',
        passwordHash: sharedPasswordHash,
        phone: '+1-555-0306',
        role: ROLES.MEMBER,
        assignedTrainer: trainerSarah._id,
        bio: 'High-intensity functional conditioning.'
      }
    ];

    const members = await User.insertMany(membersData);
    logger.info('Seeded member accounts', { count: members.length });

    // 4. Seed Memberships with varying statuses (Active, Expiring Soon, Expired)
    const now = new Date();

    // Alex: Active Quarterly Pro (expires in 45 days)
    await Membership.create({
      member: members[0]._id,
      plan: createdPlans[2]._id, // Quarterly Pro
      startDate: addDays(now, -45),
      endDate: addDays(now, 45),
      status: MEMBERSHIP_STATUS.ACTIVE,
      amountPaid: 129,
      createdBy: admin._id
    });

    // Elena: Expiring Soon Monthly Basic (expires in 4 days)
    await Membership.create({
      member: members[1]._id,
      plan: createdPlans[1]._id, // Monthly Basic
      startDate: addDays(now, -26),
      endDate: addDays(now, 4),
      status: MEMBERSHIP_STATUS.EXPIRING_SOON,
      amountPaid: 49,
      createdBy: admin._id
    });

    // Jordan: Active Annual Elite (expires in 280 days)
    await Membership.create({
      member: members[2]._id,
      plan: createdPlans[3]._id, // Annual Elite
      startDate: addDays(now, -85),
      endDate: addDays(now, 280),
      status: MEMBERSHIP_STATUS.ACTIVE,
      amountPaid: 449,
      createdBy: admin._id
    });

    // Maya: Expired Monthly Basic (expired 5 days ago)
    await Membership.create({
      member: members[3]._id,
      plan: createdPlans[1]._id, // Monthly Basic
      startDate: addDays(now, -35),
      endDate: addDays(now, -5),
      status: MEMBERSHIP_STATUS.EXPIRED,
      amountPaid: 49,
      createdBy: admin._id
    });

    // Thomas: Expiring Soon Monthly Basic (expires in 2 days)
    await Membership.create({
      member: members[4]._id,
      plan: createdPlans[1]._id,
      startDate: addDays(now, -28),
      endDate: addDays(now, 2),
      status: MEMBERSHIP_STATUS.EXPIRING_SOON,
      amountPaid: 49,
      createdBy: admin._id
    });

    // Rachel: Active Monthly Basic (expires in 20 days)
    await Membership.create({
      member: members[5]._id,
      plan: createdPlans[1]._id,
      startDate: addDays(now, -10),
      endDate: addDays(now, 20),
      status: MEMBERSHIP_STATUS.ACTIVE,
      amountPaid: 49,
      createdBy: admin._id
    });

    logger.info('Seeded member subscriptions with realistic duration states');

    // 5. Seed Workout Plans
    // Alex's Workout Routine (Created by Marcus)
    await WorkoutPlan.create({
      name: '4-Day Strength & Hypertrophy Split',
      description: 'Progressive overload protocol focused on compound lifts and volume accumulation.',
      member: members[0]._id,
      trainer: trainerMarcus._id,
      difficulty: 'Intermediate',
      isActive: true,
      schedule: [
        {
          dayOfWeek: 'Monday',
          isRestDay: false,
          focus: 'Upper Body Push',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Touch chest with pause' },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 60, notes: '30-degree incline' },
            { name: 'Overhead Cable Triceps Extension', sets: 3, reps: '12-15', restSeconds: 45, notes: 'Keep elbows tucked' }
          ]
        },
        {
          dayOfWeek: 'Tuesday',
          isRestDay: false,
          focus: 'Lower Body Quad Focus',
          exercises: [
            { name: 'Barbell Back Squat', sets: 4, reps: '6-8', restSeconds: 120, notes: 'Parallel depth' },
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 90, notes: 'Hinge hips backward' },
            { name: 'Standing Calf Raise', sets: 4, reps: '15', restSeconds: 45, notes: 'Full contraction at top' }
          ]
        },
        {
          dayOfWeek: 'Wednesday',
          isRestDay: true,
          focus: 'Rest & Recovery',
          exercises: []
        },
        {
          dayOfWeek: 'Thursday',
          isRestDay: false,
          focus: 'Upper Body Pull',
          exercises: [
            { name: 'Barbell Bent Over Row', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Keep core braced' },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Full stretch at peak' },
            { name: 'Incline Dumbbell Bicep Curl', sets: 3, reps: '12', restSeconds: 45, notes: 'Controlled tempo' }
          ]
        },
        {
          dayOfWeek: 'Friday',
          isRestDay: false,
          focus: 'Posterior Chain & Core',
          exercises: [
            { name: 'Trap Bar Deadlift', sets: 4, reps: '5', restSeconds: 120, notes: 'Drive through floor' },
            { name: 'Hanging Leg Raise', sets: 3, reps: '12', restSeconds: 45, notes: 'Avoid swinging' }
          ]
        },
        {
          dayOfWeek: 'Saturday',
          isRestDay: true,
          focus: 'Active Mobility',
          exercises: []
        },
        {
          dayOfWeek: 'Sunday',
          isRestDay: true,
          focus: 'Rest & Meal Prep',
          exercises: []
        }
      ]
    });

    // Elena's Workout Routine (Created by Sarah)
    await WorkoutPlan.create({
      name: 'Cardiovascular & Functional Conditioning',
      description: 'Aerobic base building combined with joint stability and core integrity.',
      member: members[1]._id,
      trainer: trainerSarah._id,
      difficulty: 'Intermediate',
      isActive: true,
      schedule: [
        {
          dayOfWeek: 'Monday',
          isRestDay: false,
          focus: 'Interval Running & Core',
          exercises: [
            { name: 'Treadmill Speed Intervals', sets: 6, reps: '400m', restSeconds: 90, notes: 'Zone 4 effort' },
            { name: 'Plank Hold', sets: 3, reps: '60s', restSeconds: 30, notes: 'Engage glutes' }
          ]
        },
        {
          dayOfWeek: 'Tuesday',
          isRestDay: false,
          focus: 'Full Body Mobility Circuit',
          exercises: [
            { name: 'Kettlebell Goblet Squat', sets: 3, reps: '15', restSeconds: 45, notes: 'Deep squat posture' },
            { name: 'Push-Up to Downward Dog', sets: 3, reps: '12', restSeconds: 45, notes: 'Focus on thoracic stretch' }
          ]
        },
        { dayOfWeek: 'Wednesday', isRestDay: true, focus: 'Rest', exercises: [] },
        {
          dayOfWeek: 'Thursday',
          isRestDay: false,
          focus: 'Tempo Run',
          exercises: [
            { name: 'Steady State Rowing', sets: 1, reps: '5000m', restSeconds: 0, notes: '2:05 / 500m pace target' }
          ]
        },
        { dayOfWeek: 'Friday', isRestDay: true, focus: 'Rest', exercises: [] },
        { dayOfWeek: 'Saturday', isRestDay: false, focus: 'Hill Sprints', exercises: [{ name: 'Incline Sprint', sets: 8, reps: '30s', restSeconds: 60, notes: 'Max effort' }] },
        { dayOfWeek: 'Sunday', isRestDay: true, focus: 'Rest', exercises: [] }
      ]
    });

    logger.info('Seeded comprehensive 7-day workout plans');

    // 6. Seed Realistic Attendance Records (Generating Streaks and 30-Day Trends)
    const attendances = [];

    // Alex has checked in today, yesterday, 2 days ago (streak of 3) and 12 sessions over past 25 days
    const alexCheckInDays = [0, 1, 2, 4, 6, 8, 9, 11, 14, 16, 18, 22];
    alexCheckInDays.forEach((offset) => {
      const d = addDays(now, -offset);
      attendances.push({
        member: members[0]._id,
        date: normalizeDateOnly(d),
        dateString: formatDateString(d),
        checkInTime: new Date(d.setHours(7, 30, 0, 0)),
        source: 'web_checkin',
        notes: offset === 0 ? 'Logged morning chest routine' : 'Regular session'
      });
    });

    // Elena checked in 8 times in the past month, but last visit was 8 days ago (flagged for trainer!)
    const elenaCheckInDays = [8, 10, 13, 16, 19, 21, 24, 27];
    elenaCheckInDays.forEach((offset) => {
      const d = addDays(now, -offset);
      attendances.push({
        member: members[1]._id,
        date: normalizeDateOnly(d),
        dateString: formatDateString(d),
        checkInTime: new Date(d.setHours(17, 45, 0, 0)),
        source: 'web_checkin',
        notes: 'Cardio workout'
      });
    });

    // Jordan checked in today, yesterday, and 14 days over past 20 days
    const jordanCheckInDays = [0, 1, 3, 4, 6, 7, 8, 10, 12, 14, 15, 17, 18];
    jordanCheckInDays.forEach((offset) => {
      const d = addDays(now, -offset);
      attendances.push({
        member: members[2]._id,
        date: normalizeDateOnly(d),
        dateString: formatDateString(d),
        checkInTime: new Date(d.setHours(18, 15, 0, 0)),
        source: 'web_checkin',
        notes: 'Powerlifting session'
      });
    });

    // Rachel checked in today via front desk kiosk
    attendances.push({
      member: members[5]._id,
      date: normalizeDateOnly(now),
      dateString: formatDateString(now),
      checkInTime: new Date(now.setHours(12, 10, 0, 0)),
      source: 'admin_override',
      notes: 'Front desk check-in'
    });

    await Attendance.insertMany(attendances);
    logger.info('Seeded attendance records with live streaks and trends', { count: attendances.length });

    // 7. Seed Weight Logs for Members
    const weightLogs = [
      // Alex: Progressive weight loss / lean mass recomposition
      { member: members[0]._id, weight: 82.5, unit: 'kg', date: addDays(now, -28), dateString: formatDateString(addDays(now, -28)), notes: 'Initial baseline weigh-in' },
      { member: members[0]._id, weight: 81.9, unit: 'kg', date: addDays(now, -21), dateString: formatDateString(addDays(now, -21)), notes: 'Week 1 check' },
      { member: members[0]._id, weight: 81.3, unit: 'kg', date: addDays(now, -14), dateString: formatDateString(addDays(now, -14)), notes: 'Week 2 check' },
      { member: members[0]._id, weight: 80.7, unit: 'kg', date: addDays(now, -7), dateString: formatDateString(addDays(now, -7)), notes: 'Week 3 check' },
      { member: members[0]._id, weight: 80.2, unit: 'kg', date: now, dateString: formatDateString(now), notes: 'Current morning fasted weight' },

      // Jordan: Bulking progress
      { member: members[2]._id, weight: 88.0, unit: 'kg', date: addDays(now, -30), dateString: formatDateString(addDays(now, -30)), notes: 'Bulk phase start' },
      { member: members[2]._id, weight: 89.2, unit: 'kg', date: addDays(now, -15), dateString: formatDateString(addDays(now, -15)), notes: 'Mid-month check' },
      { member: members[2]._id, weight: 90.1, unit: 'kg', date: addDays(now, -1), dateString: formatDateString(addDays(now, -1)), notes: 'Latest check' }
    ];

    await WeightLog.insertMany(weightLogs);
    logger.info('Seeded body-weight logs', { count: weightLogs.length });

    // 8. Seed Audit Logs
    await AuditLog.create({
      action: 'SYSTEM_SEEDED',
      performedBy: admin._id,
      details: { environment: process.env.NODE_ENV || 'development' },
      ipAddress: '127.0.0.1'
    });

    logger.info('GYMFLOW database seeding completed successfully.');
  } catch (error) {
    logger.error('Database seeding failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0));
}

module.exports = seed;
