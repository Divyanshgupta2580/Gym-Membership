const User = require('../models/User');
const MembershipPlan = require('../models/MembershipPlan');
const Membership = require('../models/Membership');
const Attendance = require('../models/Attendance');
const { ROLES } = require('../constants/roles');
const { MEMBERSHIP_STATUS } = require('../constants/status');
const { normalizeDateOnly, formatDateString, addDays } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const DEMO_CREDENTIALS = {
  admin: {
    email: 'admin@gymflow.test',
    password: 'Password123!',
    firstName: 'Arthur',
    lastName: 'Pendelton',
    role: ROLES.ADMIN,
    phone: '+1-555-0100'
  },
  trainer: {
    email: 'marcus.trainer@gymflow.test',
    password: 'Password123!',
    firstName: 'Marcus',
    lastName: 'Vance',
    role: ROLES.TRAINER,
    phone: '+1-555-0201',
    trainerSpecialties: ['Hypertrophy', 'Strength Training', 'Powerlifting'],
    bio: 'Certified strength and conditioning specialist with 8 years of competitive coaching experience.'
  },
  member: {
    email: 'alex.member@gymflow.test',
    password: 'Password123!',
    firstName: 'Alex',
    lastName: 'Mercer',
    role: ROLES.MEMBER,
    phone: '+1-555-0301',
    height: 182,
    weight: 80.5,
    bio: 'Focused on building lean muscle mass and improving deadlift technique.'
  }
};

const DEFAULT_PLANS = [
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

class DemoService {
  isDemoEmail(email) {
    if (!email) return false;
    const normalized = email.toLowerCase().trim();
    return Object.values(DEMO_CREDENTIALS).some((c) => c.email === normalized);
  }

  async ensureDemoAccounts() {
    try {
      logger.info('Verifying and ensuring demo accounts availability...');

      // 1. Ensure Membership Plans exist
      const planCount = await MembershipPlan.countDocuments();
      let defaultPlans = [];
      if (planCount === 0) {
        defaultPlans = await MembershipPlan.insertMany(DEFAULT_PLANS);
        logger.info('Initialized default membership plans for demo environment', { count: defaultPlans.length });
      } else {
        defaultPlans = await MembershipPlan.find({ isActive: true });
      }

      const sharedPasswordHash = await User.hashPassword('Password123!');

      // 2. Ensure Admin Demo User
      let adminUser = await User.findOne({ email: DEMO_CREDENTIALS.admin.email }).select('+passwordHash');
      if (!adminUser) {
        adminUser = await User.create({
          ...DEMO_CREDENTIALS.admin,
          passwordHash: sharedPasswordHash,
          isActive: true,
          isDemoAccount: true
        });
        logger.info('Created demo admin user', { email: adminUser.email });
      } else {
        const matches = await adminUser.comparePassword(DEMO_CREDENTIALS.admin.password);
        if (!matches || !adminUser.isActive || adminUser.role !== ROLES.ADMIN || !adminUser.isDemoAccount) {
          adminUser.passwordHash = sharedPasswordHash;
          adminUser.isActive = true;
          adminUser.role = ROLES.ADMIN;
          adminUser.isDemoAccount = true;
          await adminUser.save({ validateBeforeSave: false });
          logger.info('Synchronized demo admin user credentials and state');
        }
      }

      // 3. Ensure Trainer Demo User
      let trainerUser = await User.findOne({ email: DEMO_CREDENTIALS.trainer.email }).select('+passwordHash');
      if (!trainerUser) {
        trainerUser = await User.create({
          ...DEMO_CREDENTIALS.trainer,
          passwordHash: sharedPasswordHash,
          isActive: true,
          isDemoAccount: true
        });
        logger.info('Created demo trainer user', { email: trainerUser.email });
      } else {
        const matches = await trainerUser.comparePassword(DEMO_CREDENTIALS.trainer.password);
        if (!matches || !trainerUser.isActive || trainerUser.role !== ROLES.TRAINER || !trainerUser.isDemoAccount) {
          trainerUser.passwordHash = sharedPasswordHash;
          trainerUser.isActive = true;
          trainerUser.role = ROLES.TRAINER;
          trainerUser.isDemoAccount = true;
          await trainerUser.save({ validateBeforeSave: false });
          logger.info('Synchronized demo trainer user credentials and state');
        }
      }

      // 4. Ensure Member Demo User
      let memberUser = await User.findOne({ email: DEMO_CREDENTIALS.member.email }).select('+passwordHash');
      if (!memberUser) {
        memberUser = await User.create({
          ...DEMO_CREDENTIALS.member,
          passwordHash: sharedPasswordHash,
          assignedTrainer: trainerUser._id,
          isActive: true,
          isDemoAccount: true
        });
        logger.info('Created demo member user', { email: memberUser.email });
      } else {
        const matches = await memberUser.comparePassword(DEMO_CREDENTIALS.member.password);
        let updated = false;
        if (!matches) {
          memberUser.passwordHash = sharedPasswordHash;
          updated = true;
        }
        if (!memberUser.isActive) {
          memberUser.isActive = true;
          updated = true;
        }
        if (memberUser.role !== ROLES.MEMBER) {
          memberUser.role = ROLES.MEMBER;
          updated = true;
        }
        if (!memberUser.assignedTrainer) {
          memberUser.assignedTrainer = trainerUser._id;
          updated = true;
        }
        if (!memberUser.isDemoAccount) {
          memberUser.isDemoAccount = true;
          updated = true;
        }
        if (!memberUser.height) {
          memberUser.height = 182;
          updated = true;
        }
        if (!memberUser.weight) {
          memberUser.weight = 80.5;
          updated = true;
        }
        if (updated) {
          await memberUser.save({ validateBeforeSave: false });
          logger.info('Synchronized demo member user credentials and state');
        }
      }

      // 5. Ensure Member has an active Membership
      const existingMembership = await Membership.findOne({
        member: memberUser._id,
        status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] }
      });

      if (!existingMembership) {
        const chosenPlan = defaultPlans.find((p) => p.name === 'Quarterly Pro') || defaultPlans[0];
        if (chosenPlan) {
          const now = normalizeDateOnly(new Date());
          const startDate = addDays(now, -15);
          const endDate = addDays(startDate, chosenPlan.durationInDays);
          await Membership.create({
            member: memberUser._id,
            plan: chosenPlan._id,
            startDate,
            endDate,
            status: MEMBERSHIP_STATUS.ACTIVE,
            amountPaid: chosenPlan.price,
            notes: 'Demo member subscription',
            createdBy: adminUser._id
          });
          logger.info('Created active membership for demo member');
        }
      }

      // 6. Ensure recent attendance records for demo regularity graph
      const attendanceCount = await Attendance.countDocuments({ member: memberUser._id });
      if (attendanceCount === 0) {
        const now = new Date();
        const checkInOffsets = [0, 1, 2, 4, 6, 8, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32, 35];
        const sampleAttendances = checkInOffsets.map((offset) => {
          const d = addDays(now, -offset);
          const normDate = normalizeDateOnly(d);
          const dStr = formatDateString(d);
          const checkInTime = new Date(d);
          checkInTime.setHours(8, 30, 0, 0);
          return {
            member: memberUser._id,
            date: normDate,
            dateString: dStr,
            checkInTime,
            source: 'web_checkin',
            notes: offset === 0 ? 'Logged morning push workout' : 'Regular session'
          };
        });

        await Attendance.insertMany(sampleAttendances, { ordered: false }).catch(() => {});
        logger.info('Seeded sample regularity attendance for demo member', { count: sampleAttendances.length });
      }

      logger.info('Demo accounts verification completed successfully');
      return {
        admin: adminUser,
        trainer: trainerUser,
        member: memberUser
      };
    } catch (error) {
      logger.error('Error ensuring demo accounts', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

module.exports = new DemoService();
