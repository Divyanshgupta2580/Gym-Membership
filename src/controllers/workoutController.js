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

      // Trainer can only create plans for their assigned members; admin can create for any
      const memberQuery = { _id: memberId, role: ROLES.MEMBER, isActive: true };
      if (req.user.role === ROLES.TRAINER) {
        memberQuery.assignedTrainer = req.user._id;
      }

      const member = await User.findOne(memberQuery).lean();
      if (!member) {
        req.flash('error', 'Member not found or not assigned to you');
        return res.redirect(req.user.role === ROLES.TRAINER ? '/trainer/clients' : '/admin/members');
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

      // Authorization check
      const memberQuery = { _id: memberId, role: ROLES.MEMBER, isActive: true };
      if (req.user.role === ROLES.TRAINER) {
        memberQuery.assignedTrainer = req.user._id;
      }

      const member = await User.findOne(memberQuery);
      if (!member) {
        req.flash('error', 'Unauthorized to assign plans to this member');
        return res.redirect('/trainer/clients');
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
      const plan = await WorkoutPlan.findById(id)
        .populate('member', 'firstName lastName email')
        .populate('trainer', 'firstName lastName email')
        .lean();

      if (!plan) {
        req.flash('error', 'Workout routine not found');
        return res.redirect('/member/dashboard');
      }

      // Check access permission
      const isMemberOwner = req.user.role === ROLES.MEMBER && plan.member._id.equals(req.user._id);
      const isTrainerOwner = req.user.role === ROLES.TRAINER && plan.trainer._id.equals(req.user._id);
      const isAdmin = req.user.role === ROLES.ADMIN;

      if (!isMemberOwner && !isTrainerOwner && !isAdmin) {
        req.flash('error', 'Access denied to this workout plan');
        return res.redirect('/member/dashboard');
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
