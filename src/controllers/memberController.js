const dashboardService = require('../services/dashboardService');
const membershipService = require('../services/membershipService');
const WorkoutPlan = require('../models/WorkoutPlan');
const logger = require('../utils/logger');

class MemberController {
  async dashboard(req, res, next) {
    try {
      const requestedId = req.query.memberId || req.body?.memberId;
      if (requestedId && requestedId.toString() !== req.user._id.toString()) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another member dashboard' });
        }
        return res.status(403).render('errors/403', { message: 'Forbidden: Cannot access another member dashboard' });
      }

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
      const requestedId = req.query.memberId || req.body?.memberId;
      if (requestedId && requestedId.toString() !== req.user._id.toString()) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Cannot view another member membership' });
        }
        return res.status(403).render('errors/403', { message: 'Forbidden: Cannot view another member membership' });
      }

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
      const requestedId = req.query.memberId || req.body?.memberId;
      if (requestedId && requestedId.toString() !== req.user._id.toString()) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Cannot view another member workout plan' });
        }
        return res.status(403).render('errors/403', { message: 'Forbidden: Cannot view another member workout plan' });
      }

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
