const { body } = require('express-validator');
const { formatDateString } = require('../utils/dateUtils');

const logWeightValidator = [
  body('weight')
    .isFloat({ min: 20, max: 500 })
    .withMessage('Weight must be a realistic numeric value between 20 and 500'),
  body('unit')
    .optional()
    .isIn(['kg', 'lbs'])
    .withMessage('Unit must be either kg or lbs'),
  body('date')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date must be a valid ISO format')
    .custom((value) => {
      if (value) {
        const inputDate = new Date(value);
        const todayStr = formatDateString(new Date());
        const inputStr = formatDateString(inputDate);
        if (inputStr > todayStr) {
          throw new Error('Weight cannot be logged for future dates');
        }
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters')
];

module.exports = {
  logWeightValidator
};
