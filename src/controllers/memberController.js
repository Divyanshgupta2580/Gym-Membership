const dashboardService = require('../services/dashboardService');
const membershipService = require('../services/membershipService');
const WorkoutPlan = require('../models/WorkoutPlan');
const logger = require('../utils/logger');

class MemberController {
  async dashboard(req, res, next) {
    try {
      const data = await dashboardService.getMemberDashboardData(req.user._id);
      res.render('member/dashboard', {
        title: 'Member Dashboard',
        ...data
      });
    } catch (error) {
      logger.error('Member dashboard error', { error: error.message });
      next(error);
    }
  }

  async viewMembership(req, res, next) {
    try {
      const membership = await membershipService.getMemberActiveMembership(req.user._id);
      res.render('member/membership', {
        title: 'My Membership Plan',
        membership
      });
    } catch (error) {
      logger.error('View membership error', { error: error.message });
      next(error);
    }
  }

  async viewWorkoutPlan(req, res, next) {
    try {
      const plan = await WorkoutPlan.findOne({ member: req.user._id, isActive: true })
        .populate('trainer', 'firstName lastName email')
        .lean();

      res.render('member/workout', {
        title: 'My Workout Schedule',
        workoutPlan: plan
      });
    } catch (error) {
      logger.error('View member workout error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new MemberController();
