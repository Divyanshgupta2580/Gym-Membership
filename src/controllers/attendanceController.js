const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const attendanceService = require('../services/attendanceService');
const { emitAttendanceRecorded } = require('../sockets');
const { formatDateString } = require('../utils/dateUtils');
const { getPaginationParams, buildPaginationMetadata } = require('../utils/pagination');
const logger = require('../utils/logger');

class AttendanceController {
  /**
   * Member self check-in.
   */
  async memberCheckIn(req, res, next) {
    try {
      const memberId = req.user._id;
      const { notes } = req.body;

      const result = await attendanceService.recordCheckIn({
        memberId,
        source: 'web_checkin',
        notes: notes || ''
      });

      // Emit real-time Socket.IO event to admin and assigned trainer
      emitAttendanceRecorded({
        member: req.user,
        attendance: result.attendance,
        streak: result.streak
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: 'Attendance recorded successfully',
          streak: result.streak,
          attendance: result.attendance
        });
      }

      req.flash('success', `Check-in recorded. Current streak: ${result.streak} day${result.streak === 1 ? '' : 's'}.`);
      res.redirect('/member/attendance');
    } catch (error) {
      logger.error('Member check-in error', { error: error.message, userId: req.user._id.toString() });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(error.status || 400).json({
          success: false,
          message: error.message
        });
      }

      req.flash('error', error.message);
      res.redirect('/member/attendance');
    }
  }

  /**
   * Member view of their attendance history and streak calendar.
   */
  async memberAttendanceView(req, res, next) {
    try {
      const summary = await attendanceService.getMemberAttendanceSummary(req.user._id);

      res.render('member/attendance', {
        title: 'My Attendance & Streaks',
        ...summary
      });
    } catch (error) {
      logger.error('Member attendance view error', { error: error.message });
      next(error);
    }
  }

  /**
   * Admin gym-wide attendance ledger.
   */
  async adminAttendanceLog(req, res, next) {
    try {
      const { date, search } = req.query;
      const { page, limit, skip } = getPaginationParams(req, 15);

      const filter = {};
      if (date) {
        filter.dateString = date;
      }

      const [attendances, totalCount, activeMembers] = await Promise.all([
        Attendance.find(filter)
          .sort({ checkInTime: -1 })
          .skip(skip)
          .limit(limit)
          .populate('member', 'firstName lastName email phone')
          .lean(),
        Attendance.countDocuments(filter),
        User.find({ role: 'member', isActive: true }).select('firstName lastName email').lean()
      ]);

      const pagination = buildPaginationMetadata(totalCount, page, limit);

      res.render('admin/attendance', {
        title: 'Gym Attendance Ledger',
        attendances,
        members: activeMembers,
        filterDate: date || '',
        pagination
      });
    } catch (error) {
      logger.error('Admin attendance log error', { error: error.message });
      next(error);
    }
  }

  /**
   * Admin manual check-in override.
   */
  async adminManualCheckIn(req, res, next) {
    try {
      const { memberId, date, notes } = req.body;

      const member = await User.findById(memberId);
      if (!member || member.role !== 'member') {
        req.flash('error', 'Invalid member specified');
        return res.redirect('/admin/attendance');
      }

      const result = await attendanceService.recordCheckIn({
        memberId,
        dateInput: date || new Date(),
        source: 'admin_override',
        notes: notes || 'Recorded by gym administrator'
      });

      await AuditLog.create({
        action: 'ATTENDANCE_ADMIN_OVERRIDE',
        performedBy: req.user._id,
        targetUser: member._id,
        details: { dateString: result.attendance.dateString, notes },
        ipAddress: req.ip
      });

      emitAttendanceRecorded({
        member,
        attendance: result.attendance,
        streak: result.streak
      });

      req.flash('success', `Attendance logged for ${member.fullName}`);
      res.redirect('/admin/attendance');
    } catch (error) {
      logger.error('Admin manual check-in error', { error: error.message });
      req.flash('error', error.message || 'Failed to record attendance');
      res.redirect('/admin/attendance');
    }
  }
}

module.exports = new AttendanceController();
