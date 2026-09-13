const express = require('express');
const adminController = require('../controllers/adminController');
const membershipController = require('../controllers/membershipController');
const attendanceController = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { validateRequest } = require('../middleware/validation');
const { planValidator, assignMembershipValidator } = require('../validators/membershipValidators');
const { markAttendanceValidator } = require('../validators/attendanceValidators');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Admin Dashboard & Intelligence
router.get('/dashboard', adminController.dashboard);
router.get('/intelligence', adminController.intelligence);

// Member Management
router.get('/members', adminController.listMembers);
router.get('/members/:id', adminController.viewMember);
router.post('/members/assign-trainer', adminController.assignTrainer);
router.post('/users/:id/toggle-status', adminController.toggleUserStatus);

// Trainer Management
router.get('/trainers', adminController.listTrainers);
router.post('/trainers/create', adminController.createTrainer);

// Membership Plans
router.get('/plans', membershipController.listPlans);
router.post('/plans/create', planValidator, validateRequest, membershipController.createPlan);
router.post('/plans/:id/toggle', membershipController.togglePlanStatus);

// Membership Subscriptions
router.get('/memberships', membershipController.listMemberships);
router.post('/memberships/assign', assignMembershipValidator, validateRequest, membershipController.assignMembership);

// Attendance Ledger & Manual Override
router.get('/attendance', attendanceController.adminAttendanceLog);
router.post('/attendance/manual-checkin', markAttendanceValidator, validateRequest, attendanceController.adminManualCheckIn);

module.exports = router;
