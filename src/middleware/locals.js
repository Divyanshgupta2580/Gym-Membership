const { formatDateDisplay, formatTimeDisplay, daysRemaining, formatDateString } = require('../utils/dateUtils');
const { ROLES } = require('../constants/roles');

function setupLocals(req, res, next) {
  res.locals.appName = 'GYMFLOW';
  res.locals.currentPath = req.path;
  res.locals.query = req.query || {};
  res.locals.currentUser = req.user || null;
  res.locals.ROLES = ROLES;
  
  // Date format helpers for templates
  res.locals.formatDateDisplay = formatDateDisplay;
  res.locals.formatTimeDisplay = formatTimeDisplay;
  res.locals.daysRemaining = daysRemaining;
  res.locals.formatDateString = formatDateString;

  // Flash message handling
  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  } else {
    res.locals.flash = null;
  }

  // Form persistence and validation errors handling
  if (req.session && req.session.formInput) {
    res.locals.formInput = req.session.formInput;
    delete req.session.formInput;
  } else {
    res.locals.formInput = {};
  }

  if (req.session && req.session.formErrors) {
    res.locals.formErrors = req.session.formErrors;
    delete req.session.formErrors;
  } else {
    res.locals.formErrors = [];
  }

  // Flash helper method
  req.flash = function (type, message) {
    if (!req.session) return;
    req.session.flash = { type, message };
  };

  next();
}

module.exports = {
  setupLocals
};
