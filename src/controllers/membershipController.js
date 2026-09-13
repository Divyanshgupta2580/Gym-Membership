const mongoose = require('mongoose');
const MembershipPlan = require('../models/MembershipPlan');
const Membership = require('../models/Membership');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const membershipService = require('../services/membershipService');
const { emitMembershipUpdated } = require('../sockets');
const { getPaginationParams, buildPaginationMetadata } = require('../utils/pagination');
const { MEMBERSHIP_STATUS } = require('../constants/status');
const logger = require('../utils/logger');

class MembershipController {
  async listPlans(req, res, next) {
    try {
      const plans = await MembershipPlan.find().sort({ price: 1 }).lean();

      // Count active members per plan
      const planCounts = await Membership.aggregate([
        { $match: { status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] } } },
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ]);

      const countMap = new Map();
      planCounts.forEach((c) => countMap.set(c._id.toString(), c.count));

      const enrichedPlans = plans.map((p) => ({
        ...p,
        activeMembersCount: countMap.get(p._id.toString()) || 0
      }));

      res.render('admin/plans', {
        title: 'Membership Plans',
        plans: enrichedPlans
      });
    } catch (error) {
      logger.error('List membership plans error', { error: error.message });
      next(error);
    }
  }

  async createPlan(req, res, next) {
    try {
      const { name, description, durationInDays, price, currency, features } = req.body;

      const featureList = features
        ? features.split('\n').map((f) => f.trim()).filter(Boolean)
        : [];

      const plan = new MembershipPlan({
        name,
        description: description || '',
        durationInDays: Number(durationInDays),
        price: Number(price),
        currency: (currency || 'USD').toUpperCase(),
        features: featureList,
        isActive: true
      });

      await plan.save();

      await AuditLog.create({
        action: 'MEMBERSHIP_PLAN_CREATED',
        performedBy: req.user._id,
        details: { planId: plan._id, name: plan.name, price: plan.price },
        ipAddress: req.ip
      });

      req.flash('success', `Membership plan "${plan.name}" created successfully`);
      res.redirect('/admin/plans');
    } catch (error) {
      logger.error('Create plan error', { error: error.message });
      next(error);
    }
  }

  async togglePlanStatus(req, res, next) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid plan ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Plan ID',
          message: `The provided plan identifier "${id}" is malformed.`
        });
      }

      const plan = await MembershipPlan.findById(id);

      if (!plan) {
        req.flash('error', 'Plan not found');
        return res.redirect('/admin/plans');
      }

      plan.isActive = !plan.isActive;
      await plan.save();

      req.flash('success', `Plan "${plan.name}" is now ${plan.isActive ? 'active' : 'inactive'}`);
      res.redirect('/admin/plans');
    } catch (error) {
      logger.error('Toggle plan status error', { error: error.message });
      next(error);
    }
  }

  async listMemberships(req, res, next) {
    try {
      await membershipService.syncAllMembershipStatuses();

      const { status } = req.query;
      const { page, limit, skip } = getPaginationParams(req, 12);

      const filter = {};
      if (status && status !== 'all') {
        filter.status = status;
      }

      const [memberships, totalCount] = await Promise.all([
        Membership.find(filter)
          .sort({ endDate: -1 })
          .skip(skip)
          .limit(limit)
          .populate('member', 'firstName lastName email phone')
          .populate('plan', 'name price durationInDays')
          .populate('createdBy', 'firstName lastName')
          .lean(),
        Membership.countDocuments(filter)
      ]);

      const pagination = buildPaginationMetadata(totalCount, page, limit);

      res.render('admin/memberships', {
        title: 'Membership Subscriptions',
        memberships,
        currentStatus: status || 'all',
        pagination
      });
    } catch (error) {
      logger.error('List memberships error', { error: error.message });
      next(error);
    }
  }

  async assignMembership(req, res, next) {
    try {
      const { memberId, planId, startDate, amountPaid, notes } = req.body;

      if (!memberId || !mongoose.Types.ObjectId.isValid(memberId) || !planId || !mongoose.Types.ObjectId.isValid(planId)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ success: false, message: 'Invalid member or plan ID format' });
        }
        return res.status(400).render('errors/400', {
          title: 'Invalid Parameters',
          message: 'The specified member or plan identifier is malformed.'
        });
      }

      const membership = await membershipService.assignMembership({
        memberId,
        planId,
        startDateInput: startDate,
        createdById: req.user._id,
        notes,
        amountPaidInput: amountPaid
      });

      const [member, plan] = await Promise.all([
        User.findById(memberId),
        MembershipPlan.findById(planId)
      ]);

      await AuditLog.create({
        action: 'MEMBERSHIP_ASSIGNED',
        performedBy: req.user._id,
        targetUser: member._id,
        details: {
          planName: plan.name,
          startDate: membership.startDate,
          endDate: membership.endDate,
          amountPaid: membership.amountPaid
        },
        ipAddress: req.ip
      });

      emitMembershipUpdated({
        memberId: member._id.toString(),
        planName: plan.name,
        status: membership.status,
        endDate: membership.endDate
      });

      req.flash('success', `Membership plan "${plan.name}" successfully assigned to ${member.fullName}`);
      const returnUrl = req.header('Referer') || `/admin/members/${memberId}`;
      res.redirect(returnUrl);
    } catch (error) {
      logger.error('Assign membership error', { error: error.message });
      req.flash('error', error.message || 'Failed to assign membership');
      res.redirect(req.header('Referer') || '/admin/members');
    }
  }
}

module.exports = new MembershipController();
