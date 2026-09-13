const express = require('express');
const memberController = require('../controllers/memberController');
const attendanceController = require('../controllers/attendanceController');
const weightController = require('../controllers/weightController');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { requireMember } = require('../middleware/roles');
const { validateRequest } = require('../middleware/validation');
const { markAttendanceValidator } = require('../validators/attendanceValidators');
const { logWeightValidator } = require('../validators/weightValidators');

const router = express.Router();

router.use(requireAuth, requireMember);

// Dashboard & Membership
router.get('/dashboard', memberController.dashboard);
router.get('/membership', memberController.viewMembership);
router.get('/workout', memberController.viewWorkoutPlan);
router.get('/profile', authController.showProfile);

// Attendance tracking
router.get('/attendance', attendanceController.memberAttendanceView);
router.post('/attendance/checkin', markAttendanceValidator, validateRequest, attendanceController.memberCheckIn);

// Body weight tracking
router.get('/weight', weightController.showWeightPage);
router.post('/weight/log', logWeightValidator, validateRequest, weightController.logWeight);
router.post('/weight/:id/delete', weightController.deleteWeight);
router.get('/weight/api/data', weightController.getWeightApi);

module.exports = router;
