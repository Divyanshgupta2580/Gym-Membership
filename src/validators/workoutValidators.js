const { body } = require('express-validator');
const { DIFFICULTY_LEVELS } = require('../constants/status');

const workoutPlanValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Workout plan name is required')
    .isLength({ max: 100 })
    .withMessage('Plan name cannot exceed 100 characters'),
  body('memberId')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('difficulty')
    .optional()
    .isIn(DIFFICULTY_LEVELS)
    .withMessage('Invalid difficulty level'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

module.exports = {
  workoutPlanValidator
};
