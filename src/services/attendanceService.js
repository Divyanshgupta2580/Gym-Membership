const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { formatDateString, normalizeDateOnly, addDays, calculateAttendanceStreak } = require('../utils/dateUtils');

class AttendanceService {
  /**
   * Record a check-in for a member.
   * Enforces date constraints and database-level duplicate prevention.
   */
  async recordCheckIn({ memberId, dateInput, source = 'web_checkin', notes = '' }) {
    const today = new Date();
    const todayStr = formatDateString(today);
    const targetDate = dateInput ? new Date(dateInput) : today;
    const targetDateStr = formatDateString(targetDate);

    // Reject future dates
    if (targetDateStr > todayStr) {
      throw new Error('Attendance cannot be recorded for a future date');
    }

    // Check existing attendance for this member on this date
    const existing = await Attendance.findOne({
      member: memberId,
      dateString: targetDateStr
    });

    if (existing) {
      const err = new Error(`Attendance has already been recorded for ${targetDateStr}`);
      err.code = 'DUPLICATE_ATTENDANCE';
      err.status = 409;
      throw err;
    }

    const attendance = new Attendance({
      member: memberId,
      date: normalizeDateOnly(targetDate),
      dateString: targetDateStr,
      checkInTime: new Date(),
      source,
      notes
    });

    try {
      await attendance.save();
    } catch (error) {
      if (error.code === 11000) {
        const err = new Error(`Attendance has already been recorded for ${targetDateStr}`);
        err.code = 'DUPLICATE_ATTENDANCE';
        err.status = 409;
        throw err;
      }
      throw error;
    }

    // Calculate updated streak
    const allRecords = await Attendance.find({ member: memberId }).select('dateString').lean();
    const streak = calculateAttendanceStreak(allRecords.map((r) => r.dateString));

    return {
      attendance,
      streak
    };
  }

  /**
   * Get attendance calendar and summary for a member.
   */
  async getMemberAttendanceSummary(memberId) {
    const records = await Attendance.find({ member: memberId })
      .sort({ dateString: -1 })
      .lean();

    const dateStrings = records.map((r) => r.dateString);
    const streak = calculateAttendanceStreak(dateStrings);
    const totalVisits = records.length;

    const todayStr = formatDateString(new Date());
    const thirtyDaysAgoStr = formatDateString(addDays(new Date(), -30));
    const visitsLast30Days = dateStrings.filter((d) => d >= thirtyDaysAgoStr && d <= todayStr).length;

    const hasCheckedInToday = dateStrings.includes(todayStr);

    return {
      records,
      streak,
      totalVisits,
      visitsLast30Days,
      hasCheckedInToday
    };
  }

  /**
   * Today's gym check-ins and trend for admin dashboard.
   */
  async getGymAttendanceOverview() {
    const todayStr = formatDateString(new Date());

    const todayCheckIns = await Attendance.find({ dateString: todayStr })
      .populate('member', 'firstName lastName email')
      .sort({ checkInTime: -1 })
      .lean();

    // 7-day attendance trend
    const trendDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      trendDays.push(formatDateString(d));
    }

    const weeklyCounts = await Attendance.aggregate([
      { $match: { dateString: { $in: trendDays } } },
      { $group: { _id: '$dateString', count: { $sum: 1 } } }
    ]);

    const countMap = new Map();
    weeklyCounts.forEach((w) => countMap.set(w._id, w.count));

    const trend = trendDays.map((dStr) => ({
      dateString: dStr,
      count: countMap.get(dStr) || 0
    }));

    return {
      todayCount: todayCheckIns.length,
      todayCheckIns,
      trend
    };
  }

  /**
   * Assigned members attendance for a trainer dashboard.
   */
  async getTrainerAssignedAttendance(trainerId) {
    const assignedMembers = await User.find({ assignedTrainer: trainerId, isActive: true }).select('_id');
    const memberIds = assignedMembers.map((m) => m._id);

    const todayStr = formatDateString(new Date());

    const todayCheckIns = await Attendance.find({
      member: { $in: memberIds },
      dateString: todayStr
    })
      .populate('member', 'firstName lastName email')
      .sort({ checkInTime: -1 })
      .lean();

    return {
      todayAssignedCount: todayCheckIns.length,
      todayCheckIns
    };
  }
}

module.exports = new AttendanceService();
