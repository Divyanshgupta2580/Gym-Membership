const express = require('express');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const trainerRoutes = require('./trainerRoutes');
const memberRoutes = require('./memberRoutes');
const MembershipPlan = require('../models/MembershipPlan');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Public Landing Page
router.get('/', async (req, res, next) => {
  try {
    if (req.user) {
      switch (req.user.role) {
        case ROLES.ADMIN:
          return res.redirect('/admin/dashboard');
        case ROLES.TRAINER:
          return res.redirect('/trainer/dashboard');
        case ROLES.MEMBER:
          return res.redirect('/member/dashboard');
      }
    }

    const plans = await MembershipPlan.find({ isActive: true }).sort({ price: 1 }).lean();

    res.render('landing', {
      title: 'GYMFLOW - Gym Membership & Fitness Intelligence Platform',
      layout: false,
      plans
    });
  } catch (error) {
    next(error);
  }
});

// Mount Sub-routers
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/trainer', trainerRoutes);
router.use('/member', memberRoutes);

module.exports = router;
