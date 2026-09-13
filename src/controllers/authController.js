const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

class AuthController {
  showLogin(req, res) {
    res.render('auth/login', {
      title: 'Sign In',
      layout: 'layouts/auth',
      returnTo: req.query.returnTo || ''
    });
  }

  async login(req, res) {
    const { email, password, returnTo } = req.body;

    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
      if (!user) {
        req.flash('error', 'Invalid email or password credentials');
        return res.redirect(`/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
      }

      if (!user.isActive) {
        req.flash('error', 'This account has been deactivated. Please contact gym administration.');
        return res.redirect('/auth/login');
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        req.flash('error', 'Invalid email or password credentials');
        return res.redirect(`/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
      }

      // Update last login timestamp
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          logger.error('Session regeneration error', { error: err.message });
          req.flash('error', 'Unable to initialize session');
          return res.redirect('/auth/login');
        }

        req.session.userId = user._id.toString();
        req.session.userRole = user.role;

        logger.info('User authenticated successfully', {
          userId: user._id.toString(),
          role: user.role
        });

        if (returnTo && returnTo.startsWith('/')) {
          return res.redirect(returnTo);
        }

        switch (user.role) {
          case ROLES.ADMIN:
            return res.redirect('/admin/dashboard');
          case ROLES.TRAINER:
            return res.redirect('/trainer/dashboard');
          case ROLES.MEMBER:
            return res.redirect('/member/dashboard');
          default:
            return res.redirect('/');
        }
      });
    } catch (error) {
      logger.error('Login process error', { error: error.message });
      req.flash('error', 'An error occurred during authentication');
      res.redirect('/auth/login');
    }
  }

  showRegister(req, res) {
    res.render('auth/register', {
      title: 'Member Registration',
      layout: 'layouts/auth'
    });
  }

  async register(req, res) {
    const { firstName, lastName, email, password, phone } = req.body;

    try {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        req.flash('error', 'An account with that email address already exists');
        return res.redirect('/auth/register');
      }

      const passwordHash = await User.hashPassword(password);

      const user = new User({
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        phone: phone || '',
        role: ROLES.MEMBER,
        isActive: true,
        lastLogin: new Date()
      });

      await user.save();

      // Audit log registration
      await AuditLog.create({
        action: 'USER_REGISTERED',
        performedBy: user._id,
        targetUser: user._id,
        details: { email: user.email, role: user.role },
        ipAddress: req.ip
      });

      req.session.regenerate((err) => {
        if (err) {
          logger.error('Session regeneration error during registration', { error: err.message });
          return res.redirect('/auth/login');
        }

        req.session.userId = user._id.toString();
        req.session.userRole = user.role;

        req.flash('success', 'Account registered successfully. Welcome to GYMFLOW.');
        res.redirect('/member/dashboard');
      });
    } catch (error) {
      logger.error('Registration failure', { error: error.message });
      req.flash('error', error.message || 'Failed to register account');
      res.redirect('/auth/register');
    }
  }

  logout(req, res) {
    const userId = req.session?.userId;
    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout session destruction error', { error: err.message });
      }
      res.clearCookie('gymflow.sid');
      if (userId) {
        logger.info('User logged out', { userId });
      }
      res.redirect('/auth/login');
    });
  }

  async showProfile(req, res) {
    const user = await User.findById(req.user._id).populate('assignedTrainer', 'firstName lastName email phone');
    res.render('member/profile', {
      title: 'My Profile',
      user
    });
  }

  async updateProfile(req, res) {
    const { firstName, lastName, phone, bio } = req.body;

    try {
      await User.findByIdAndUpdate(req.user._id, {
        firstName,
        lastName,
        phone: phone || '',
        bio: bio || ''
      }, { runValidators: true });

      req.flash('success', 'Profile updated successfully');
      res.redirect('/member/profile');
    } catch (error) {
      logger.error('Profile update failure', { error: error.message });
      req.flash('error', error.message || 'Could not update profile');
      res.redirect('/member/profile');
    }
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;

    try {
      const user = await User.findById(req.user._id).select('+passwordHash');
      const isMatch = await user.comparePassword(currentPassword);

      if (!isMatch) {
        req.flash('error', 'Incorrect current password');
        return res.redirect('/member/profile');
      }

      user.passwordHash = await User.hashPassword(newPassword);
      await user.save({ validateBeforeSave: false });

      await AuditLog.create({
        action: 'PASSWORD_CHANGED',
        performedBy: user._id,
        targetUser: user._id,
        details: { timestamp: new Date() },
        ipAddress: req.ip
      });

      req.flash('success', 'Password updated successfully');
      res.redirect('/member/profile');
    } catch (error) {
      logger.error('Password change error', { error: error.message });
      req.flash('error', 'Failed to change password');
      res.redirect('/member/profile');
    }
  }
}

module.exports = new AuthController();
