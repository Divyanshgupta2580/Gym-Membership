const mongoose = require('mongoose');
const WorkoutPlan = require('../models/WorkoutPlan');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { DAYS_OF_WEEK, DIFFICULTY_LEVELS } = require('../constants/status');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

class WorkoutController {
  async showCreatePlan(req, res, next) {
    try {
      const { memberId } = req.query;

      if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid or missing member ID' });
        }
        req.flash('error', 'Invalid member ID');
        return res.status(400).redirect(req.user.role === ROLES.TRAINER ? '/trainer/clients' : '/admin/members');
      }

      const member = await User.findById(memberId).lean();
      if (!member || member.role !== ROLES.MEMBER || !member.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Member not found' });
        }
        req.flash('error', 'Member not found');
        return res.status(404).redirect(req.user.role === ROLES.TRAINER ? '/trainer/clients' : '/admin/members');
      }

      if (req.user.role === ROLES.TRAINER && member.assignedTrainer?.toString() !== req.user._id.toString()) {
        logger.warn('Unauthorized attempt by trainer to create workout plan for unassigned member', {
          trainerId: req.user._id.toString(),
          memberId
        });
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Member is not assigned to you' });
        }
        req.flash('error', 'Member is not assigned to you');
        return res.status(403).render('errors/403', { message: 'Forbidden: Member is not assigned to you' });
      }

      res.render('trainer/workoutPlanForm', {
        title: `Create Workout Routine: ${member.firstName} ${member.lastName}`,
        member,
        daysOfWeek: DAYS_OF_WEEK,
        difficultyLevels: DIFFICULTY_LEVELS,
        plan: null,
        isEdit: false
      });
    } catch (error) {
      logger.error('Show create workout plan error', { error: error.message });
      next(error);
    }
  }

  async createPlan(req, res, next) {
    try {
      const { memberId, name, description, difficulty, scheduleJson } = req.body;

      if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid or missing member ID' });
        }
        req.flash('error', 'Invalid member ID');
        return res.status(400).redirect('/trainer/clients');
      }

      const member = await User.findById(memberId);
      if (!member || member.role !== ROLES.MEMBER || !member.isActive) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Member not found' });
        }
        req.flash('error', 'Member not found');
        return res.status(404).redirect('/trainer/clients');
      }

      if (req.user.role === ROLES.TRAINER && member.assignedTrainer?.toString() !== req.user._id.toString()) {
        logger.warn('Unauthorized attempt by trainer to assign workout plan to unassigned member', {
          trainerId: req.user._id.toString(),
          memberId
        });
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Member is not assigned to you' });
        }
        req.flash('error', 'Member is not assigned to you');
        return res.status(403).render('errors/403', { message: 'Forbidden: Member is not assigned to you' });
      }

      let schedule = [];
      if (typeof scheduleJson === 'string') {
        try {
          schedule = JSON.parse(scheduleJson);
        } catch {
          schedule = [];
        }
      } else if (Array.isArray(scheduleJson)) {
        schedule = scheduleJson;
      }

      // Deactivate any existing active workout plans for this member
      await WorkoutPlan.updateMany({ member: memberId, isActive: true }, { $set: { isActive: false } });

      const workoutPlan = new WorkoutPlan({
        name,
        description: description || '',
        member: memberId,
        trainer: req.user._id,
        difficulty: difficulty || 'Intermediate',
        schedule,
        isActive: true
      });

      await workoutPlan.save();

      await AuditLog.create({
        action: 'WORKOUT_PLAN_CREATED',
        performedBy: req.user._id,
        targetUser: member._id,
        details: { planName: name, difficulty, daysCount: schedule.length },
        ipAddress: req.ip
      });

      req.flash('success', `Workout routine "${name}" assigned to ${member.fullName}`);
      const redirectUrl = req.user.role === ROLES.TRAINER
        ? `/trainer/clients/${memberId}`
        : `/admin/members/${memberId}`;
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Create workout plan error', { error: error.message });
      req.flash('error', error.message || 'Failed to create workout routine');
      res.redirect(req.header('Referer') || '/trainer/clients');
    }
  }

  async viewPlan(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid workout plan ID' });
        }
        req.flash('error', 'Invalid workout plan ID');
        return res.status(400).redirect('/member/dashboard');
      }

      const plan = await WorkoutPlan.findById(id)
        .populate('member', 'firstName lastName email')
        .populate('trainer', 'firstName lastName email')
        .lean();

      if (!plan) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Workout routine not found' });
        }
        req.flash('error', 'Workout routine not found');
        return res.status(404).redirect('/member/dashboard');
      }

      // Check access permission
      const isMemberOwner = req.user.role === ROLES.MEMBER && plan.member._id.equals(req.user._id);
      const isTrainerOwner = req.user.role === ROLES.TRAINER && plan.trainer._id.equals(req.user._id);
      const isAdmin = req.user.role === ROLES.ADMIN;

      if (!isMemberOwner && !isTrainerOwner && !isAdmin) {
        logger.warn('Unauthorized workout plan access attempt', {
          userId: req.user._id.toString(),
          role: req.user.role,
          planId: id,
          planOwnerId: plan.member._id.toString()
        });
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Forbidden: Access denied to this workout plan' });
        }
        req.flash('error', 'Access denied to this workout plan');
        return res.status(403).render('errors/403', { message: 'Forbidden: Access denied to this workout plan' });
      }

      res.render('member/workout', {
        title: plan.name,
        workoutPlan: plan
      });
    } catch (error) {
      logger.error('View workout plan error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new WorkoutController();
