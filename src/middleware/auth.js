const User = require('../models/User');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  req.user = null;

  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.isActive) {
      // If user was deleted or deactivated, clear session
      req.session.destroy((err) => {
        if (err) logger.error('Session destroy failure', { error: err.message });
      });
      return next();
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    logger.error('Error attaching user to request', { error: error.message });
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.user && req.user.isActive) {
    return next();
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const returnUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/auth/login?returnTo=${returnUrl}`);
}

function requireGuest(req, res, next) {
  if (!req.user) {
    return next();
  }

  // Redirect authenticated user to their role-specific dashboard
  switch (req.user.role) {
    case ROLES.ADMIN:
      return res.redirect('/admin/dashboard');
    case ROLES.TRAINER:
      return res.redirect('/trainer/dashboard');
    case ROLES.MEMBER:
      return res.redirect('/member/dashboard');
    default:
      return res.redirect('/');
  }
}

module.exports = {
  attachUser,
  requireAuth,
  requireGuest
};
