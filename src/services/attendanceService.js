const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const {
  formatDateString,
  normalizeDateOnly,
  addDays,
  formatTimeDisplay,
  calculateAttendanceStreak,
  calculateLongestStreak
} = require('../utils/dateUtils');

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
   * Generates a 52-week calendar activity heatmap inspired by the GitHub contribution graph.
   * Uses actual attendance records for the given memberId.
   */
  async getAttendanceHeatmap(memberId) {
    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      throw new Error('Valid member ID is required for attendance heatmap');
    }

    // 1. Fetch all attendance records for this member
    const records = await Attendance.find({ member: memberId })
      .select('date dateString checkInTime notes')
      .sort({ dateString: 1 })
      .lean();

    const attendanceMap = new Map();
    const dateStrings = [];

    records.forEach((rec) => {
      attendanceMap.set(rec.dateString, rec);
      dateStrings.push(rec.dateString);
    });

    const currentStreak = calculateAttendanceStreak(dateStrings);
    const longestStreak = calculateLongestStreak(dateStrings);
    const totalVisits = records.length;

    // 2. Build 52-week calendar grid (364 days ending today)
    const today = normalizeDateOnly(new Date());
    const todayStr = formatDateString(today);

    // Align grid with Sunday-Saturday columns:
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
    const gridEndDate = addDays(today, 6 - currentDayOfWeek);
    const gridStartDate = addDays(gridEndDate, -363);

    const weeks = [];
    let currentWeek = [];
    const monthLabels = [];
    let lastMonth = -1;
    let activeDaysCount = 0;
    let totalPastDaysCount = 0;

    let cursor = new Date(gridStartDate);
    let weekIndex = 0;

    while (cursor <= gridEndDate) {
      const cursorStr = formatDateString(cursor);
      const isFuture = cursorStr > todayStr;
      const isToday = cursorStr === todayStr;
      const attendance = attendanceMap.get(cursorStr);
      const count = attendance ? 1 : 0;

      if (!isFuture) {
        totalPastDaysCount++;
        if (count > 0) activeDaysCount++;
      }

      // Check for month label change at the beginning of the week (Sunday)
      if (cursor.getDay() === 0) {
        const monthNum = cursor.getMonth();
        if (monthNum !== lastMonth) {
          const monthShort = cursor.toLocaleDateString('en-US', { month: 'short' });
          monthLabels.push({ label: monthShort, weekIndex });
          lastMonth = monthNum;
        }
      }

      // Intensity level: 0 = none, 1 = attended
      let intensity = 0;
      if (count > 0) {
        intensity = 1;
      }

      const dayCell = {
        dateString: cursorStr,
        dayOfWeek: cursor.getDay(),
        dayOfMonth: cursor.getDate(),
        month: cursor.toLocaleDateString('en-US', { month: 'short' }),
        year: cursor.getFullYear(),
        count,
        intensity,
        isToday,
        isFuture,
        checkInTime: attendance ? formatTimeDisplay(attendance.checkInTime) : null,
        notes: attendance?.notes || '',
        status: count > 0 ? 'Attended' : 'No attendance'
      };

      currentWeek.push(dayCell);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      cursor = addDays(cursor, 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const attendanceRate = totalPastDaysCount > 0
      ? ((activeDaysCount / totalPastDaysCount) * 100).toFixed(1)
      : '0.0';

    return {
      weeks,
      monthLabels,
      summary: {
        totalVisits,
        activeDays: activeDaysCount,
        currentStreak,
        longestStreak,
        attendanceRate: `${attendanceRate}%`,
        daysTracked: totalPastDaysCount
      }
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
