const mongoose = require('mongoose');
const User = require('../models/User');
const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const WorkoutPlan = require('../models/WorkoutPlan');
const Attendance = require('../models/Attendance');
const WeightLog = require('../models/WeightLog');
const AuditLog = require('../models/AuditLog');
const dashboardService = require('../services/dashboardService');
const fitnessIntelligenceService = require('../services/fitnessIntelligenceService');
const membershipService = require('../services/membershipService');
const { emitTrainerAssigned } = require('../sockets');
const { ROLES } = require('../constants/roles');
const { getPaginationParams, buildPaginationMetadata } = require('../utils/pagination');
const logger = require('../utils/logger');

class AdminController {
  async dashboard(req, res, next) {
    try {
      const data = await dashboardService.getAdminDashboardData();
      res.render('admin/dashboard', {
        title: 'Admin Operations Hub',
        ...data
      });
    } catch (error) {
      logger.error('Admin dashboard error', { error: error.message });
      const fallback = {
        metrics: {
          totalMembers: 0,
          totalTrainers: 0,
          activeMemberships: 0,
          expiringSoonMemberships: 0,
          todayAttendance: 0,
          totalRevenue: 0
        },
        attendanceTrend: [],
        planDistribution: [],
        todayCheckIns: [],
        recentMembers: [],
        recentAuditLogs: [],
        intelligenceSummary: {}
      };
      res.render('admin/dashboard', { title: 'Admin Operations Hub', ...fallback });
    }
  }

  async listMembers(req, res, next) {
    try {
      const { search, status, trainer } = req.query;
      const { page, limit, skip } = getPaginationParams(req, 10);

      const filter = { role: ROLES.MEMBER };

      if (search && search.trim()) {
        const query = search.trim();
        filter.$or = [
          { email: { $regex: query, $options: 'i' } }
        ];
      }

      if (trainer && trainer !== 'all') {
        filter.assignedTrainer = trainer;
      }

      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      }

      const [members, totalCount, allTrainers] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('assignedTrainer', 'firstName lastName')
          .lean(),
        User.countDocuments(filter),
        User.find({ role: ROLES.TRAINER, isActive: true }).select('firstName lastName').lean()
      ]);

      // Attach current membership status for each member
      const memberIds = members.map((m) => m._id);
      const activeMemberships = await Membership.find({
        member: { $in: memberIds },
        status: { $in: ['active', 'expiring_soon'] }
      }).populate('plan', 'name').lean();

      const membershipMap = new Map();
      activeMemberships.forEach((sub) => {
        membershipMap.set(sub.member.toString(), sub);
      });

      const enrichedMembers = members.map((m) => ({
        ...m,
        membership: membershipMap.get(m._id.toString()) || null
      }));

      const pagination = buildPaginationMetadata(totalCount, page, limit);

      res.render('admin/members', {
        title: 'Member Management',
        members: enrichedMembers,
        trainers: allTrainers,
        filters: { search: search || '', status: status || 'all', trainer: trainer || 'all' },
        pagination
      });
    } catch (error) {
      logger.error('Admin list members error', { error: error.message });
      next(error);
    }
  }

  async viewMember(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid member ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Member ID',
          message: `The provided member identifier "${id}" is malformed.`
        });
      }

      const member = await User.findOne({ _id: id, role: ROLES.MEMBER })
        .populate('assignedTrainer', 'firstName lastName email phone')
        .lean();

      if (!member) {
        req.flash('error', 'Member record not found');
        return res.redirect('/admin/members');
      }

      const [memberships, plans, trainers, attendances, weightLogs, workoutPlan, intelligence] = await Promise.all([
        Membership.find({ member: id }).sort({ endDate: -1 }).populate('plan').lean(),
        MembershipPlan.find({ isActive: true }).lean(),
        User.find({ role: ROLES.TRAINER, isActive: true }).select('firstName lastName specialties').lean(),
        Attendance.find({ member: id }).sort({ dateString: -1 }).limit(15).lean(),
        WeightLog.find({ member: id }).sort({ date: -1 }).limit(10).lean(),
        WorkoutPlan.findOne({ member: id, isActive: true }).populate('trainer', 'firstName lastName').lean(),
        fitnessIntelligenceService.getMemberIntelligence(id)
      ]);

      res.render('admin/memberDetail', {
        title: `Member: ${member.firstName} ${member.lastName}`,
        member,
        memberships,
        plans,
        trainers,
        attendances,
        weightLogs,
        workoutPlan,
        intelligence
      });
    } catch (error) {
      logger.error('Admin view member detail error', { error: error.message });
      next(error);
    }
  }

  async assignTrainer(req, res, next) {
    try {
      const { memberId, trainerId } = req.body;

      if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid member ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Member ID',
          message: 'The specified member identifier is malformed.'
        });
      }

      if (trainerId && trainerId !== 'none' && !mongoose.Types.ObjectId.isValid(trainerId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid trainer ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Trainer ID',
          message: 'The specified trainer identifier is malformed.'
        });
      }

      const member = await User.findById(memberId);
      if (!member || member.role !== ROLES.MEMBER) {
        req.flash('error', 'Invalid member specified');
        return res.redirect('/admin/members');
      }

      let trainer = null;
      if (trainerId && trainerId !== 'none') {
        trainer = await User.findOne({ _id: trainerId, role: ROLES.TRAINER, isActive: true });
        if (!trainer) {
          req.flash('error', 'Specified trainer was not found or is inactive');
          return res.redirect(`/admin/members/${memberId}`);
        }
        member.assignedTrainer = trainer._id;
      } else {
        member.assignedTrainer = null;
      }

      await member.save();

      await AuditLog.create({
        action: trainer ? 'MEMBER_ASSIGNED_TRAINER' : 'MEMBER_UNASSIGNED_TRAINER',
        performedBy: req.user._id,
        targetUser: member._id,
        details: { trainerId: trainer ? trainer._id : null, trainerName: trainer ? trainer.fullName : 'None' },
        ipAddress: req.ip
      });

      if (trainer) {
        emitTrainerAssigned({
          memberId: member._id.toString(),
          memberName: member.fullName,
          trainerId: trainer._id.toString(),
          trainerName: trainer.fullName
        });
      }

      req.flash('success', trainer ? `Assigned to coach ${trainer.fullName}` : 'Trainer unassigned');
      res.redirect(`/admin/members/${memberId}`);
    } catch (error) {
      logger.error('Assign trainer error', { error: error.message });
      next(error);
    }
  }

  async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid User ID',
          message: `The provided user identifier "${id}" is malformed.`
        });
      }

      const user = await User.findById(id);

      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/members');
      }

      if (user._id.equals(req.user._id)) {
        req.flash('error', 'You cannot deactivate your own administrative account');
        return res.redirect('/admin/members');
      }

      user.isActive = !user.isActive;
      await user.save();

      await AuditLog.create({
        action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        performedBy: req.user._id,
        targetUser: user._id,
        details: { email: user.email, role: user.role, isActive: user.isActive },
        ipAddress: req.ip
      });

      req.flash('success', `Account for ${user.fullName} has been ${user.isActive ? 'activated' : 'deactivated'}`);
      const redirectPath = user.role === ROLES.TRAINER ? '/admin/trainers' : `/admin/members/${user._id}`;
      res.redirect(redirectPath);
    } catch (error) {
      logger.error('Toggle user status error', { error: error.message });
      next(error);
    }
  }

  async listTrainers(req, res, next) {
    try {
      const trainers = await User.find({ role: ROLES.TRAINER })
        .sort({ lastName: 1 })
        .lean();

      // Count assigned members for each trainer
      const trainerCounts = await User.aggregate([
        { $match: { role: ROLES.MEMBER, isActive: true, assignedTrainer: { $ne: null } } },
        { $group: { _id: '$assignedTrainer', count: { $sum: 1 } } }
      ]);

      const countMap = new Map();
      trainerCounts.forEach((t) => countMap.set(t._id.toString(), t.count));

      const enrichedTrainers = trainers.map((tr) => ({
        ...tr,
        assignedClientsCount: countMap.get(tr._id.toString()) || 0
      }));

      res.render('admin/trainers', {
        title: 'Trainer Staff Roster',
        trainers: enrichedTrainers
      });
    } catch (error) {
      logger.error('List trainers error', { error: error.message });
      next(error);
    }
  }

  async createTrainer(req, res, next) {
    try {
      const { firstName, lastName, email, password, phone, specialties, bio } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        req.flash('error', 'A staff or member account already exists with that email');
        return res.redirect('/admin/trainers');
      }

      const passwordHash = await User.hashPassword(password);
      const parsedSpecialties = specialties
        ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const trainer = new User({
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        phone: phone || '',
        role: ROLES.TRAINER,
        trainerSpecialties: parsedSpecialties,
        bio: bio || '',
        isActive: true
      });

      await trainer.save();

      await AuditLog.create({
        action: 'TRAINER_CREATED',
        performedBy: req.user._id,
        targetUser: trainer._id,
        details: { email: trainer.email, specialties: parsedSpecialties },
        ipAddress: req.ip
      });

      req.flash('success', `Trainer ${trainer.fullName} successfully registered`);
      res.redirect('/admin/trainers');
    } catch (error) {
      logger.error('Create trainer error', { error: error.message });
      next(error);
    }
  }

  async intelligence(req, res, next) {
    try {
      const intelligence = await fitnessIntelligenceService.getAdminAggregateIntelligence();
      res.render('admin/intelligence', {
        title: 'Fitness Intelligence & Churn Radar',
        intelligence
      });
    } catch (error) {
      logger.error('Admin intelligence error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new AdminController();
