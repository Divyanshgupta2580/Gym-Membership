const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const { ROLES } = require('../../src/constants/roles');
const { formatDateString, addDays } = require('../../src/utils/dateUtils');
const attendanceService = require('../../src/services/attendanceService');

describe('Attendance System & Duplicate Check-in Prevention', () => {
  let member;

  beforeEach(async () => {
    member = await User.create({
      firstName: 'Samantha',
      lastName: 'Reed',
      email: 'samantha@gymflow.test',
      passwordHash: await User.hashPassword('Password123!'),
      role: ROLES.MEMBER
    });
  });

  test('successfully records check-in for the current day and computes streak', async () => {
    const result = await attendanceService.recordCheckIn({
      memberId: member._id,
      source: 'web_checkin',
      notes: 'Morning session'
    });

    expect(result.attendance).toBeDefined();
    expect(result.attendance.member.toString()).toBe(member._id.toString());
    expect(result.attendance.dateString).toBe(formatDateString(new Date()));
    expect(result.streak).toBe(1);

    const count = await Attendance.countDocuments({ member: member._id });
    expect(count).toBe(1);
  });

  test('rejects duplicate attendance for the same member on the same day with 409 error', async () => {
    // First check-in
    await attendanceService.recordCheckIn({
      memberId: member._id,
      source: 'web_checkin'
    });

    // Attempt second check-in on the exact same date
    await expect(
      attendanceService.recordCheckIn({
        memberId: member._id,
        source: 'web_checkin'
      })
    ).rejects.toThrow('Attendance has already been recorded');

    const count = await Attendance.countDocuments({ member: member._id });
    expect(count).toBe(1);
  });

  test('rejects check-in for future dates', async () => {
    const futureDate = addDays(new Date(), 2);

    await expect(
      attendanceService.recordCheckIn({
        memberId: member._id,
        dateInput: futureDate
      })
    ).rejects.toThrow('Attendance cannot be recorded for a future date');
  });

  test('calculates correct multi-day streak across contiguous records', async () => {
    const today = new Date();
    const yesterday = addDays(today, -1);
    const twoDaysAgo = addDays(today, -2);

    // Seed yesterday and two days ago
    await Attendance.create({
      member: member._id,
      date: twoDaysAgo,
      dateString: formatDateString(twoDaysAgo)
    });

    await Attendance.create({
      member: member._id,
      date: yesterday,
      dateString: formatDateString(yesterday)
    });

    // Today check-in
    const result = await attendanceService.recordCheckIn({
      memberId: member._id
    });

    expect(result.streak).toBe(3);
  });
});
