const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const { MEMBERSHIP_STATUS } = require('../constants/status');
const { addDays, normalizeDateOnly } = require('../utils/dateUtils');
const { EXPIRING_SOON_THRESHOLD_DAYS } = require('../config/environment');

class MembershipService {
  /**
   * Automatically synchronizes stale membership statuses based on current date.
   */
  async syncAllMembershipStatuses() {
    const now = normalizeDateOnly(new Date());
    const expiringSoonThreshold = addDays(now, EXPIRING_SOON_THRESHOLD_DAYS);

    // 1. Mark expired
    await Membership.updateMany(
      {
        status: { $ne: MEMBERSHIP_STATUS.CANCELLED },
        endDate: { $lt: now }
      },
      { $set: { status: MEMBERSHIP_STATUS.EXPIRED } }
    );

    // 2. Mark expiring soon
    await Membership.updateMany(
      {
        status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.PENDING] },
        endDate: { $gte: now, $lte: expiringSoonThreshold }
      },
      { $set: { status: MEMBERSHIP_STATUS.EXPIRING_SOON } }
    );

    // 3. Mark active
    await Membership.updateMany(
      {
        status: { $in: [MEMBERSHIP_STATUS.EXPIRING_SOON, MEMBERSHIP_STATUS.PENDING] },
        startDate: { $lte: now },
        endDate: { $gt: expiringSoonThreshold }
      },
      { $set: { status: MEMBERSHIP_STATUS.ACTIVE } }
    );
  }

  /**
   * Assign or renew a membership for a member.
   */
  async assignMembership({ memberId, planId, startDateInput, createdById, notes, amountPaidInput }) {
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new Error('Selected membership plan is inactive or does not exist');
    }

    const startDate = startDateInput ? normalizeDateOnly(new Date(startDateInput)) : normalizeDateOnly(new Date());
    const endDate = addDays(startDate, plan.durationInDays);
    const amountPaid = amountPaidInput !== undefined ? Number(amountPaidInput) : plan.price;

    // Deactivate previous active memberships for this member
    await Membership.updateMany(
      {
        member: memberId,
        status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] }
      },
      { $set: { status: MEMBERSHIP_STATUS.EXPIRED } }
    );

    const membership = new Membership({
      member: memberId,
      plan: plan._id,
      startDate,
      endDate,
      amountPaid,
      notes: notes || '',
      createdBy: createdById || null
    });

    membership.syncDerivedStatus();
    await membership.save();

    return membership;
  }

  /**
   * Retrieve active or latest membership for a member.
   */
  async getMemberActiveMembership(memberId) {
    const membership = await Membership.findOne({ member: memberId })
      .sort({ endDate: -1 })
      .populate('plan')
      .populate('createdBy', 'firstName lastName');

    if (membership) {
      membership.syncDerivedStatus();
    }
    return membership;
  }

  /**
   * Aggregate statistics for gym memberships.
   */
  async getMembershipStats() {
    await this.syncAllMembershipStatuses();

    const [statusCounts, planDistribution, revenueResult] = await Promise.all([
      Membership.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Membership.aggregate([
        { $match: { status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.EXPIRING_SOON] } } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'membershipplans',
            localField: '_id',
            remoteField: '_id',
            as: 'planDetails'
          }
        },
        { $unwind: '$planDetails' },
        {
          $project: {
            planName: '$planDetails.name',
            count: 1
          }
        }
      ]),
      Membership.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amountPaid' } } }
      ])
    ]);

    const stats = {
      active: 0,
      expiringSoon: 0,
      expired: 0,
      cancelled: 0,
      total: 0,
      totalRevenue: revenueResult[0]?.totalRevenue || 0,
      planDistribution
    };

    statusCounts.forEach((item) => {
      if (item._id === MEMBERSHIP_STATUS.ACTIVE) stats.active = item.count;
      else if (item._id === MEMBERSHIP_STATUS.EXPIRING_SOON) stats.expiringSoon = item.count;
      else if (item._id === MEMBERSHIP_STATUS.EXPIRED) stats.expired = item.count;
      else if (item._id === MEMBERSHIP_STATUS.CANCELLED) stats.cancelled = item.count;
      stats.total += item.count;
    });

    return stats;
  }
}

module.exports = new MembershipService();
