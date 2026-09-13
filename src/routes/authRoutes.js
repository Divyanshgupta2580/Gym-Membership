const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, requireGuest } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validateRequest } = require('../middleware/validation');
const {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  updateProfileValidator
} = require('../validators/authValidators');

const router = express.Router();

router.get('/login', requireGuest, authController.showLogin);
router.post('/login', requireGuest, authLimiter, loginValidator, validateRequest, authController.login);

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', requireGuest, authLimiter, registerValidator, validateRequest, authController.register);

router.post('/logout', requireAuth, authController.logout);
router.get('/logout', requireAuth, authController.logout);

router.post('/profile', requireAuth, updateProfileValidator, validateRequest, authController.updateProfile);
router.post('/change-password', requireAuth, changePasswordValidator, validateRequest, authController.changePassword);

module.exports = router;
