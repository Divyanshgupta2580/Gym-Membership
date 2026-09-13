const { ROLES } = require('../constants/roles');
const membershipService = require('../services/membershipService');
const logger = require('../utils/logger');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized role access attempt', {
        userId: req.user._id.toString(),
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.originalUrl
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      return res.status(403).render('errors/403', {
        message: 'You do not have permission to view or access this resource.'
      });
    }

    next();
  };
}

/**
 * MEMBERSHIP ACCESS POLICY:
 * Actions that REQUIRE an active membership:
 * - Member self check-in: POST /member/attendance/checkin
 * - Logging body weight: POST /member/weight/log
 * - Deleting weight entry: POST /member/weight/:id/delete
 *
 * Actions that DO NOT require an active membership:
 * - Viewing profile: GET /member/profile
 * - Updating profile: POST /auth/profile
 * - Changing password: POST /auth/change-password
 * - Viewing dashboard: GET /member/dashboard (displays status & renewal notice)
 * - Viewing membership details: GET /member/membership
 * - Viewing workout plan: GET /member/workout
 * - Viewing attendance history: GET /member/attendance
 * - Viewing weight history: GET /member/weight
 * - Weight chart API: GET /member/weight/api/data
 * - Logging out: GET /auth/logout, POST /auth/logout
 * - Public landing / renewal flows
 */
async function requireActiveMembership(req, res, next) {
  if (!req.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    return res.redirect('/auth/login');
  }

  // Admins and Trainers do not require gym member subscriptions
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.TRAINER) {
    return next();
  }

  try {
    // Authoritatively resolve latest valid membership from MongoDB (never trust session cache)
    const activeMembership = await membershipService.getCurrentActiveMembership(req.user._id);

    if (!activeMembership) {
      logger.warn('Action rejected: Active membership required', {
        userId: req.user._id.toString(),
        path: req.originalUrl
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          code: 'MEMBERSHIP_INACTIVE',
          message: 'An active membership subscription is required to perform this action. Please renew your membership.'
        });
      }

      req.flash('error', 'An active membership is required for this action. Please renew or purchase a subscription.');
      return res.status(403).render('errors/403', {
        message: 'An active membership subscription is required to perform this action. Please renew your plan.'
      });
    }

    req.membership = activeMembership;
    next();
  } catch (error) {
    logger.error('Error resolving active membership status', {
      error: error.message,
      userId: req.user._id.toString()
    });
    next(error);
  }
}

const requireAdmin = requireRole(ROLES.ADMIN);
const requireTrainer = requireRole(ROLES.TRAINER);
const requireMember = requireRole(ROLES.MEMBER);
const requireTrainerOrAdmin = requireRole(ROLES.TRAINER, ROLES.ADMIN);

module.exports = {
  requireRole,
  requireAdmin,
  requireTrainer,
  requireMember,
  requireTrainerOrAdmin,
  requireActiveMembership
};
