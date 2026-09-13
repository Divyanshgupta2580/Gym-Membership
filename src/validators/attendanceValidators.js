const { body } = require('express-validator');
const { formatDateString } = require('../utils/dateUtils');

const markAttendanceValidator = [
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
          throw new Error('Attendance cannot be marked for future dates');
        }
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Notes cannot exceed 300 characters')
];

module.exports = {
  markAttendanceValidator
};
