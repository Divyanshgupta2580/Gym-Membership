const mongoose = require('mongoose');
const User = require('../models/User');
const Membership = require('../models/Membership');
const WorkoutPlan = require('../models/WorkoutPlan');
const Attendance = require('../models/Attendance');
const WeightLog = require('../models/WeightLog');
const dashboardService = require('../services/dashboardService');
const fitnessIntelligenceService = require('../services/fitnessIntelligenceService');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

class TrainerController {
  async dashboard(req, res, next) {
    try {
      const data = await dashboardService.getTrainerDashboardData(req.user._id);
      res.render('trainer/dashboard', {
        title: 'Trainer Dashboard',
        ...data
      });
    } catch (error) {
      logger.error('Trainer dashboard error', { error: error.message });
      next(error);
    }
  }

  async listClients(req, res, next) {
    try {
      const clients = await User.find({
        assignedTrainer: req.user._id,
        role: 'member',
        isActive: true
      }).sort({ lastName: 1 }).lean();

      const clientIds = clients.map((c) => c._id);

      // Fetch active plans and latest attendance
      const [plans, latestAttendances] = await Promise.all([
        WorkoutPlan.find({ member: { $in: clientIds }, isActive: true }).select('member name difficulty').lean(),
        Attendance.aggregate([
          { $match: { member: { $in: clientIds } } },
          { $sort: { dateString: -1 } },
          { $group: { _id: '$member', latestDate: { $first: '$dateString' } } }
        ])
      ]);

      const planMap = new Map();
      plans.forEach((p) => planMap.set(p.member.toString(), p));

      const attendanceMap = new Map();
      latestAttendances.forEach((a) => attendanceMap.set(a._id.toString(), a.latestDate));

      const enrichedClients = clients.map((c) => ({
        ...c,
        activePlan: planMap.get(c._id.toString()) || null,
        latestAttendance: attendanceMap.get(c._id.toString()) || 'None'
      }));

      res.render('trainer/clients', {
        title: 'Assigned Members',
        clients: enrichedClients
      });
    } catch (error) {
      logger.error('List clients error', { error: error.message });
      next(error);
    }
  }

  async viewClient(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid client ID' });
        }
        req.flash('error', 'Invalid client ID');
        return res.status(400).redirect('/trainer/clients');
      }

      const client = await User.findById(id).lean();

      if (!client || client.role !== ROLES.MEMBER || !client.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Client not found' });
        }
        req.flash('error', 'Client not found');
        return res.redirect('/trainer/clients');
      }

      const isAssigned = client.assignedTrainer && client.assignedTrainer.toString() === req.user._id.toString();
      const isAdmin = req.user.role === ROLES.ADMIN;

      if (!isAssigned && !isAdmin) {
        logger.warn('Unauthorized trainer client access attempt', {
          trainerId: req.user._id.toString(),
          clientId: id,
          assignedTrainer: client.assignedTrainer?.toString()
        });
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Client is not assigned to your roster' });
        }
        req.flash('error', 'Client is not assigned to your roster');
        return res.status(403).render('errors/403', { message: 'Forbidden: Client is not assigned to your roster' });
      }

      const [membership, workoutPlan, attendances, weightLogs, intelligence] = await Promise.all([
        Membership.findOne({ member: id, status: { $in: ['active', 'expiring_soon'] } }).populate('plan').lean(),
        WorkoutPlan.findOne({ member: id, isActive: true }).lean(),
        Attendance.find({ member: id }).sort({ dateString: -1 }).limit(20).lean(),
        WeightLog.find({ member: id }).sort({ date: -1 }).limit(10).lean(),
        fitnessIntelligenceService.getMemberIntelligence(id)
      ]);

      res.render('trainer/clientDetail', {
        title: `Client: ${client.firstName} ${client.lastName}`,
        client,
        membership,
        workoutPlan,
        attendances,
        weightLogs,
        intelligence
      });
    } catch (error) {
      logger.error('View client error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new TrainerController();
