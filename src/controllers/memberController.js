const mongoose = require('mongoose');
const dashboardService = require('../services/dashboardService');
const membershipService = require('../services/membershipService');
const MembershipPlan = require('../models/MembershipPlan');
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

      const [membership, availablePlans] = await Promise.all([
        membershipService.getMemberActiveMembership(req.user._id),
        MembershipPlan.find({ isActive: true }).sort({ price: 1 }).lean()
      ]);

      res.render('member/membership', {
        title: 'My Membership Plan',
        membership,
        availablePlans
      });
    } catch (error) {
      logger.error('View membership error', { error: error.message });
      next(error);
    }
  }

  async viewPlanDetails(req, res, next) {
    try {
      const { planId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(planId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid plan ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Plan ID',
          message: 'The requested membership plan ID format is invalid.'
        });
      }

      const plan = await MembershipPlan.findById(planId).lean();
      if (!plan || !plan.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Membership plan not found' });
        }
        return res.status(404).render('errors/404', {
          title: 'Plan Not Found',
          message: 'The requested membership plan could not be found or is inactive.'
        });
      }

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, plan });
      }

      res.render('member/planDetail', {
        title: `${plan.name} - Plan Details`,
        plan
      });
    } catch (error) {
      logger.error('View plan details error', { error: error.message });
      next(error);
    }
  }

  async selectDemoPlan(req, res, next) {
    try {
      const { planId } = req.body;

      if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid plan ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Plan ID',
          message: 'The selected membership plan ID is missing or invalid.'
        });
      }

      const plan = await MembershipPlan.findById(planId);
      if (!plan || !plan.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Selected membership plan not found' });
        }
        req.flash('error', 'Selected membership plan not found or is currently inactive.');
        return res.redirect('/member/membership');
      }

      // Assign demo membership safely without charging or claiming payment completed
      await membershipService.assignMembership({
        memberId: req.user._id,
        planId: plan._id,
        startDateInput: new Date(),
        createdById: req.user._id,
        notes: 'Demo plan preview activation (no payment processed)',
        amountPaidInput: 0
      });

      req.flash('success', `Demo plan "${plan.name}" preview activated successfully.`);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: `Demo plan "${plan.name}" preview activated successfully.`,
          planName: plan.name
        });
      }

      res.redirect('/member/membership');
    } catch (error) {
      logger.error('Select demo plan error', { error: error.message });
      req.flash('error', error.message || 'Failed to activate demo plan');
      res.redirect('/member/membership');
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
