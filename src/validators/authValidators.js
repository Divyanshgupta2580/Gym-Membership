const { body } = require('express-validator');

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const registerValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone cannot exceed 20 characters'),
  body('height')
    .notEmpty()
    .withMessage('Height is required')
    .isFloat({ min: 50, max: 280 })
    .withMessage('Height must be a numeric value between 50 and 280 cm')
    .toFloat(),
  body('weight')
    .notEmpty()
    .withMessage('Weight is required')
    .isFloat({ min: 20, max: 400 })
    .withMessage('Weight must be a numeric value between 20 and 400 kg')
    .toFloat()
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New password and confirmation do not match');
      }
      return true;
    })
];

const updateProfileValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone cannot exceed 20 characters'),
  body('height')
    .optional({ checkFalsy: true })
    .isFloat({ min: 50, max: 280 })
    .withMessage('Height must be a numeric value between 50 and 280 cm')
    .toFloat(),
  body('weight')
    .optional({ checkFalsy: true })
    .isFloat({ min: 20, max: 400 })
    .withMessage('Weight must be a numeric value between 20 and 400 kg')
    .toFloat(),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
];

module.exports = {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  updateProfileValidator
};
