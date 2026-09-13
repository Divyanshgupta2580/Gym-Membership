const User = require('../models/User');
const Membership = require('../models/Membership');
const WorkoutPlan = require('../models/WorkoutPlan');
const Attendance = require('../models/Attendance');
const WeightLog = require('../models/WeightLog');
const AuditLog = require('../models/AuditLog');
const membershipService = require('./membershipService');
const attendanceService = require('./attendanceService');
const fitnessIntelligenceService = require('./fitnessIntelligenceService');
const { ROLES } = require('../constants/roles');
const { formatDateString, normalizeDateOnly } = require('../utils/dateUtils');

class DashboardService {
  /**
   * Complete aggregation for the Administrator dashboard.
   */
  async getAdminDashboardData() {
    const [
      totalMembers,
      totalTrainers,
      membershipStats,
      attendanceOverview,
      recentMembers,
      recentAuditLogs,
      intelligenceSummary
    ] = await Promise.all([
      User.countDocuments({ role: ROLES.MEMBER, isActive: true }),
      User.countDocuments({ role: ROLES.TRAINER, isActive: true }),
      membershipService.getMembershipStats(),
      attendanceService.getGymAttendanceOverview(),
      User.find({ role: ROLES.MEMBER })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt isActive assignedTrainer')
        .populate('assignedTrainer', 'firstName lastName')
        .lean(),
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('performedBy', 'firstName lastName email')
        .populate('targetUser', 'firstName lastName email')
        .lean(),
      fitnessIntelligenceService.getAdminAggregateIntelligence()
    ]);

    return {
      metrics: {
        totalMembers,
        totalTrainers,
        activeMemberships: membershipStats.active,
        expiringSoonMemberships: membershipStats.expiringSoon,
        expiredMemberships: membershipStats.expired,
        todayAttendance: attendanceOverview.todayCount,
        totalRevenue: membershipStats.totalRevenue
      },
      attendanceTrend: attendanceOverview.trend,
      planDistribution: membershipStats.planDistribution,
      todayCheckIns: attendanceOverview.todayCheckIns.slice(0, 10),
      recentMembers,
      recentAuditLogs,
      intelligenceSummary
    };
  }

  /**
   * Complete aggregation for a Trainer's dashboard.
   */
  async getTrainerDashboardData(trainerId) {
    const todayStr = formatDateString(new Date());

    const [
      assignedMembers,
      activePlansCount,
      trainerInsights,
      todayAttendance
    ] = await Promise.all([
      User.find({ assignedTrainer: trainerId, isActive: true })
        .sort({ lastName: 1 })
        .select('firstName lastName email phone lastLogin createdAt')
        .lean(),
      WorkoutPlan.countDocuments({ trainer: trainerId, isActive: true }),
      fitnessIntelligenceService.getTrainerInsights(trainerId),
      attendanceService.getTrainerAssignedAttendance(trainerId)
    ]);

    return {
      assignedCount: assignedMembers.length,
      activePlansCount,
      todayAttendanceCount: todayAttendance.todayAssignedCount,
      todayCheckIns: todayAttendance.todayCheckIns,
      insights: trainerInsights,
      assignedMembers: assignedMembers.slice(0, 10)
    };
  }

  /**
   * Complete aggregation for a Member's personal dashboard.
   */
  async getMemberDashboardData(memberId) {
    const todayStr = formatDateString(new Date());
    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const [
      memberUser,
      membership,
      activeWorkoutPlan,
      attendanceSummary,
      weightLogs,
      intelligence
    ] = await Promise.all([
      User.findById(memberId).populate('assignedTrainer', 'firstName lastName email phone bio trainerSpecialties').lean(),
      membershipService.getMemberActiveMembership(memberId),
      WorkoutPlan.findOne({ member: memberId, isActive: true }).populate('trainer', 'firstName lastName').lean(),
      attendanceService.getMemberAttendanceSummary(memberId),
      WeightLog.find({ member: memberId }).sort({ date: 1 }).lean(),
      fitnessIntelligenceService.getMemberIntelligence(memberId)
    ]);

    // Find today's workout if scheduled
    let todayWorkout = null;
    if (activeWorkoutPlan && activeWorkoutPlan.schedule) {
      todayWorkout = activeWorkoutPlan.schedule.find((s) => s.dayOfWeek === todayDayName) || null;
    }

    return {
      member: memberUser,
      membership,
      workoutPlan: activeWorkoutPlan,
      todayWorkout,
      attendanceSummary,
      weightLogs,
      intelligence
    };
  }
}

module.exports = new DashboardService();
