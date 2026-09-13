const User = require('../models/User');
const Membership = require('../models/Membership');
const WorkoutPlan = require('../models/WorkoutPlan');
const Attendance = require('../models/Attendance');
const WeightLog = require('../models/WeightLog');
const dashboardService = require('../services/dashboardService');
const fitnessIntelligenceService = require('../services/fitnessIntelligenceService');
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

      const client = await User.findOne({
        _id: id,
        assignedTrainer: req.user._id,
        isActive: true
      }).lean();

      if (!client) {
        req.flash('error', 'Client not found or not assigned to your roster');
        return res.redirect('/trainer/clients');
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
