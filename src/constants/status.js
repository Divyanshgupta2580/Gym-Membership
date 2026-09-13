const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  PENDING: 'pending'
};

const PAYMENT_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const DIFFICULTY_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced'
];

module.exports = {
  MEMBERSHIP_STATUS,
  PAYMENT_STATUS,
  DAYS_OF_WEEK,
  DIFFICULTY_LEVELS
};
