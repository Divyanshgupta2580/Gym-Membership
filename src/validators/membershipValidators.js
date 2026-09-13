const { body } = require('express-validator');

const planValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Plan name is required')
    .isLength({ max: 80 })
    .withMessage('Plan name cannot exceed 80 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Description cannot exceed 300 characters'),
  body('durationInDays')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive number of days (at least 1)'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be 0 or a positive number'),
  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter ISO code')
];

const assignMembershipValidator = [
  body('memberId')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('planId')
    .isMongoId()
    .withMessage('Valid plan ID is required'),
  body('startDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('amountPaid')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount paid must be 0 or greater')
];

module.exports = {
  planValidator,
  assignMembershipValidator
};
