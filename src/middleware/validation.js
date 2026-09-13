const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const formattedErrors = errors.array().map((err) => ({
    field: err.path || err.param,
    message: err.msg
  }));

  const firstMessage = formattedErrors[0]?.message || 'Invalid input submission';

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(422).json({
      success: false,
      message: firstMessage,
      errors: formattedErrors
    });
  }

  req.flash('error', firstMessage);
  // Store form body temporarily for repopulation if needed
  if (req.session) {
    req.session.formErrors = formattedErrors;
    req.session.formInput = { ...req.body };
    delete req.session.formInput.password;
    delete req.session.formInput.confirmPassword;
    delete req.session.formInput._csrf;
  }

  const backUrl = req.header('Referer') || req.originalUrl || '/';
  res.redirect(backUrl);
}

module.exports = {
  validateRequest
};
