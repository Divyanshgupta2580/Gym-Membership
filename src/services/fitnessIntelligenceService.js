const Attendance = require('../models/Attendance');
const WeightLog = require('../models/WeightLog');
const WorkoutPlan = require('../models/WorkoutPlan');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { formatDateString, addDays, daysBetween, calculateAttendanceStreak } = require('../utils/dateUtils');
const { MEMBERSHIP_STATUS } = require('../constants/status');

class FitnessIntelligenceService {
  /**
   * Calculate deterministic intelligence profile for an individual member.
   * @param {string|ObjectId} memberId
   */
  async getMemberIntelligence(memberId) {
    const now = new Date();
    const todayStr = formatDateString(now);

    // 1. Fetch member attendance data
    const attendances = await Attendance.find({ member: memberId })
      .sort({ dateString: -1 })
      .lean();

    const attendanceDateStrings = attendances.map((a) => a.dateString);
    const attendanceCountTotal = attendances.length;
    const currentStreak = calculateAttendanceStreak(attendanceDateStrings);

    // Window calculations (last 14 days and prior 14 days)
    const fourteenDaysAgoStr = formatDateString(addDays(now, -14));
    const twentyEightDaysAgoStr = formatDateString(addDays(now, -28));
    const thirtyDaysAgoStr = formatDateString(addDays(now, -30));

    const last14DaysCount = attendanceDateStrings.filter(
      (d) => d >= fourteenDaysAgoStr && d <= todayStr
    ).length;

    const prior14DaysCount = attendanceDateStrings.filter(
      (d) => d >= twentyEightDaysAgoStr && d < fourteenDaysAgoStr
    ).length;

    const last30DaysCount = attendanceDateStrings.filter(
      (d) => d >= thirtyDaysAgoStr && d <= todayStr
    ).length;

    let consistencyTrend = 'stable';
    if (last14DaysCount > prior14DaysCount + 1) {
      consistencyTrend = 'improving';
    } else if (last14DaysCount < prior14DaysCount - 1) {
      consistencyTrend = 'declining';
    }

    // 2. Fetch active workout plan and calculate adherence
    const activeWorkoutPlan = await WorkoutPlan.findOne({
      member: memberId,
      isActive: true
    }).lean();

    let plannedWorkoutDaysCount = 0;
    let workoutAdherenceRate = 0;

    if (activeWorkoutPlan && activeWorkoutPlan.schedule) {
      plannedWorkoutDaysCount = activeWorkoutPlan.schedule.filter(
        (day) => !day.isRestDay && day.exercises && day.exercises.length > 0
      ).length;

      if (plannedWorkoutDaysCount > 0) {
        // Look at attendance in the last 7 days vs weekly planned days
        const sevenDaysAgoStr = formatDateString(addDays(now, -7));
        const last7DaysAttendance = attendanceDateStrings.filter(
          (d) => d >= sevenDaysAgoStr && d <= todayStr
        ).length;

        workoutAdherenceRate = Math.min(
          100,
          Math.round((last7DaysAttendance / plannedWorkoutDaysCount) * 100)
        );
      }
    }

    // 3. Weight trend analysis
    const weightLogs = await WeightLog.find({ member: memberId })
      .sort({ date: 1 })
      .lean();

    let weightTrend = {
      hasData: false,
      firstWeight: null,
      latestWeight: null,
      netChange: 0,
      unit: 'kg',
      trajectory: 'stable',
      ratePerWeek: 0,
      logsCount: weightLogs.length
    };

    if (weightLogs.length > 0) {
      const firstLog = weightLogs[0];
      const latestLog = weightLogs[weightLogs.length - 1];
      const unit = latestLog.unit || 'kg';
      const netChange = Number((latestLog.weight - firstLog.weight).toFixed(2));

      let trajectory = 'stable';
      if (netChange > 0.5) trajectory = 'increasing';
      else if (netChange < -0.5) trajectory = 'decreasing';

      // Rate per week if multiple logs over time
      let ratePerWeek = 0;
      if (weightLogs.length > 1) {
        const days = Math.max(1, daysBetween(firstLog.date, latestLog.date));
        const weeks = days / 7;
        ratePerWeek = Number((netChange / (weeks || 1)).toFixed(2));
      }

      weightTrend = {
        hasData: true,
        firstWeight: firstLog.weight,
        latestWeight: latestLog.weight,
        netChange,
        unit,
        trajectory,
        ratePerWeek,
        logsCount: weightLogs.length
      };
    }

    // 4. Activity status
    let daysSinceLastAttendance = null;
    let activityLevel = 'No records';

    if (attendances.length > 0) {
      const latestAttendanceDate = new Date(attendances[0].date);
      daysSinceLastAttendance = daysBetween(latestAttendanceDate, now);

      if (daysSinceLastAttendance <= 3) {
        activityLevel = 'High Activity';
      } else if (daysSinceLastAttendance <= 7) {
        activityLevel = 'Moderate Activity';
      } else if (daysSinceLastAttendance <= 14) {
        activityLevel = 'Low Activity';
      } else {
        activityLevel = 'Prolonged Inactivity';
      }
    }

    // 5. Generate deterministic natural language summary
    const summarySentences = [];

    if (attendanceCountTotal === 0) {
      summarySentences.push(
        'No attendance sessions have been logged yet. Check in to begin tracking your consistency.'
      );
    } else {
      summarySentences.push(
        `You have logged ${attendanceCountTotal} total session${attendanceCountTotal > 1 ? 's' : ''}, with ${last14DaysCount} check-in${last14DaysCount === 1 ? '' : 's'} over the past 14 days.`
      );

      if (currentStreak > 1) {
        summarySentences.push(`You currently have an active streak of ${currentStreak} consecutive days.`);
      }

      if (consistencyTrend === 'improving') {
        summarySentences.push(
          'Your attendance consistency has improved compared to the prior two-week period.'
        );
      } else if (consistencyTrend === 'declining') {
        summarySentences.push(
          'Your check-in frequency has decreased compared to the prior two-week period.'
        );
      } else {
        summarySentences.push('Your attendance frequency has remained consistent.');
      }
    }

    if (activeWorkoutPlan && plannedWorkoutDaysCount > 0) {
      summarySentences.push(
        `Your active workout plan targets ${plannedWorkoutDaysCount} training day${plannedWorkoutDaysCount > 1 ? 's' : ''} per week. Your recent schedule adherence is ${workoutAdherenceRate}%.`
      );
    }

    if (weightTrend.hasData) {
      const directionWord =
        weightTrend.netChange > 0
          ? `+${weightTrend.netChange} ${weightTrend.unit}`
          : `${weightTrend.netChange} ${weightTrend.unit}`;

      summarySentences.push(
        `Across ${weightTrend.logsCount} weight record${weightTrend.logsCount > 1 ? 's' : ''}, your total recorded change is ${directionWord}.`
      );
    }

    const narrativeSummary = summarySentences.join(' ');

    return {
      attendance: {
        total: attendanceCountTotal,
        currentStreak,
        last14DaysCount,
        prior14DaysCount,
        last30DaysCount,
        consistencyTrend,
        daysSinceLastAttendance,
        activityLevel
      },
      workoutAdherence: {
        hasPlan: !!activeWorkoutPlan,
        planName: activeWorkoutPlan?.name || null,
        plannedDaysPerWeek: plannedWorkoutDaysCount,
        adherenceRate: workoutAdherenceRate
      },
      weight: weightTrend,
      narrativeSummary
    };
  }

  /**
   * Trainer insights: inspect all members assigned to a specific trainer.
   * Identifies members needing attention (low attendance, prolonged absence, missing logs).
   * @param {string|ObjectId} trainerId
   */
  async getTrainerInsights(trainerId) {
    const assignedMembers = await User.find({
      assignedTrainer: trainerId,
      isActive: true
    }).select('firstName lastName email phone lastLogin createdAt').lean();

    const memberIds = assignedMembers.map((m) => m._id);
    const now = new Date();
    const fourteenDaysAgoStr = formatDateString(addDays(now, -14));

    // Get attendance in last 14 days for all assigned members
    const recentAttendances = await Attendance.find({
      member: { $in: memberIds },
      dateString: { $gte: fourteenDaysAgoStr }
    }).lean();

    const attendanceMap = new Map();
    recentAttendances.forEach((att) => {
      const idStr = att.member.toString();
      attendanceMap.set(idStr, (attendanceMap.get(idStr) || 0) + 1);
    });

    // Get latest weight log for each assigned member
    const weightLogs = await WeightLog.aggregate([
      { $match: { member: { $in: memberIds } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$member',
          latestDate: { $first: '$date' },
          latestWeight: { $first: '$weight' },
          unit: { $first: '$unit' }
        }
      }
    ]);

    const weightMap = new Map();
    weightLogs.forEach((w) => {
      weightMap.set(w._id.toString(), w);
    });

    const flaggedMembers = [];
    const highEngagementMembers = [];

    for (const member of assignedMembers) {
      const idStr = member._id.toString();
      const recentCount = attendanceMap.get(idStr) || 0;
      const weightInfo = weightMap.get(idStr);

      const flags = [];
      if (recentCount === 0) {
        flags.push('No attendance in last 14 days');
      } else if (recentCount < 2) {
        flags.push('Low attendance (< 2 sessions in 14 days)');
      }

      if (!weightInfo) {
        flags.push('No weight records logged');
      } else {
        const daysSinceWeight = daysBetween(weightInfo.latestDate, now);
        if (daysSinceWeight > 21) {
          flags.push(`No weight update for ${daysSinceWeight} days`);
        }
      }

      const clientSummary = {
        memberId: member._id,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
        recentAttendance14d: recentCount,
        latestWeight: weightInfo ? `${weightInfo.latestWeight} ${weightInfo.unit}` : 'None',
        flags,
        needsAttention: flags.length > 0
      };

      if (clientSummary.needsAttention) {
        flaggedMembers.push(clientSummary);
      } else {
        highEngagementMembers.push(clientSummary);
      }
    }

    return {
      totalAssigned: assignedMembers.length,
      needsAttentionCount: flaggedMembers.length,
      highEngagementCount: highEngagementMembers.length,
      flaggedMembers,
      highEngagementMembers
    };
  }

  /**
   * Admin aggregate intelligence: gym-wide operational and engagement insights.
   */
  async getAdminAggregateIntelligence() {
    const now = new Date();
    const todayStr = formatDateString(now);
    const thirtyDaysAgoStr = formatDateString(addDays(now, -30));

    // Active members
    const totalActiveMembers = await User.countDocuments({
      role: 'member',
      isActive: true
    });

    // Total attendances in last 30 days
    const recentAttendancesCount = await Attendance.countDocuments({
      dateString: { $gte: thirtyDaysAgoStr, $lte: todayStr }
    });

    // Average check-ins per active member in last 30 days
    const averageMonthlyCheckins = totalActiveMembers > 0
      ? Number((recentAttendancesCount / totalActiveMembers).toFixed(1))
      : 0;

    // Identify at-risk memberships (expiring within 7 days AND attendance in last 14 days <= 1)
    const sevenDaysLater = addDays(now, 7);
    const expiringSoonMemberships = await Membership.find({
      status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] },
      endDate: { $gte: now, $lte: sevenDaysLater }
    }).populate('member', 'firstName lastName email').populate('plan', 'name price').lean();

    const fourteenDaysAgoStr = formatDateString(addDays(now, -14));
    const expiringMemberIds = expiringSoonMemberships.map((m) => m.member?._id).filter(Boolean);

    const expiringAttendances = await Attendance.find({
      member: { $in: expiringMemberIds },
      dateString: { $gte: fourteenDaysAgoStr }
    }).lean();

    const attCounts = new Map();
    expiringAttendances.forEach((a) => {
      const idStr = a.member.toString();
      attCounts.set(idStr, (attCounts.get(idStr) || 0) + 1);
    });

    const atRiskRenewals = expiringSoonMemberships.map((sub) => {
      const mId = sub.member?._id?.toString();
      const recentVisits = attCounts.get(mId) || 0;
      const daysUntilExpiry = daysBetween(now, sub.endDate);
      const isHighChurnRisk = recentVisits <= 1;

      return {
        membershipId: sub._id,
        member: sub.member,
        planName: sub.plan?.name || 'Standard Plan',
        daysUntilExpiry,
        recentVisits14d: recentVisits,
        isHighChurnRisk
      };
    });

    return {
      totalActiveMembers,
      thirtyDaysAttendanceTotal: recentAttendancesCount,
      averageMonthlyCheckins,
      expiringSoonTotal: expiringSoonMemberships.length,
      highChurnRiskTotal: atRiskRenewals.filter((r) => r.isHighChurnRisk).length,
      atRiskRenewals
    };
  }
}

module.exports = new FitnessIntelligenceService();
