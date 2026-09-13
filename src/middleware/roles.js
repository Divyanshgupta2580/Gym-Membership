const { ROLES } = require('../constants/roles');
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

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view or access this resource.'
      });
    }

    next();
  };
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
  requireTrainerOrAdmin
};
