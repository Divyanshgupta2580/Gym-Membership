const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const attendanceService = require('../../src/services/attendanceService');
const { ROLES } = require('../../src/constants/roles');
const { formatDateString, normalizeDateOnly, addDays } = require('../../src/utils/dateUtils');

describe('GitHub-Style Gym Regularity Activity Graph', () => {
  let app;
  let memberA;
  let memberB;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');
    memberA = await User.create({
      firstName: 'Jordan',
      lastName: 'Miller',
      email: 'jordan.regularity@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: 180,
      weight: 78
    });

    memberB = await User.create({
      firstName: 'Chloe',
      lastName: 'Price',
      email: 'chloe.regularity@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: 165,
      weight: 55
    });
  });

  test('Correctly aggregates attendance into 52-week calendar grid with intensity levels', async () => {
    const now = new Date();
    // Seed contiguous 4-day check-in for Member A ending today
    const checkInDates = [0, 1, 2, 3, 7, 14];
    for (const offset of checkInDates) {
      const d = addDays(now, -offset);
      await Attendance.create({
        member: memberA._id,
        date: normalizeDateOnly(d),
        dateString: formatDateString(d),
        checkInTime: d,
        source: 'web_checkin'
      });
    }

    const heatmap = await attendanceService.getAttendanceHeatmap(memberA._id);

    expect(heatmap).toBeDefined();
    expect(heatmap.weeks.length).toBeGreaterThanOrEqual(52);
    // Each week must contain exactly 7 days
    heatmap.weeks.forEach((week) => {
      expect(week.length).toBe(7);
    });

    // Check summary statistics
    expect(heatmap.summary.totalVisits).toBe(6);
    expect(heatmap.summary.activeDays).toBe(6);
    expect(heatmap.summary.currentStreak).toBe(4);
    expect(heatmap.summary.longestStreak).toBe(4);

    // Verify cell intensity
    const todayStr = formatDateString(now);
    let todayFound = false;
    for (const week of heatmap.weeks) {
      for (const day of week) {
        if (day.dateString === todayStr) {
          todayFound = true;
          expect(day.intensity).toBe(1);
          expect(day.status).toBe('Attended');
        }
      }
    }
    expect(todayFound).toBe(true);
  });

  test('Gracefully handles members with zero attendance history without NaN or errors', async () => {
    // Member B has 0 attendance records
    const heatmap = await attendanceService.getAttendanceHeatmap(memberB._id);

    expect(heatmap).toBeDefined();
    expect(heatmap.weeks.length).toBeGreaterThanOrEqual(52);
    expect(heatmap.summary.totalVisits).toBe(0);
    expect(heatmap.summary.activeDays).toBe(0);
    expect(heatmap.summary.currentStreak).toBe(0);
    expect(heatmap.summary.longestStreak).toBe(0);
    expect(heatmap.summary.attendanceRate).toBe('0.0%');

    // All past cells should have intensity 0
    let attendedCellCount = 0;
    for (const week of heatmap.weeks) {
      for (const day of week) {
        if (day.intensity > 0) attendedCellCount++;
      }
    }
    expect(attendedCellCount).toBe(0);
  });

  test('Member dashboard and attendance pages render activity graph HTML', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'jordan.regularity@gymflow.test', password: 'Password123!' });

    const dashRes = await agent.get('/member/dashboard');
    expect(dashRes.status).toBe(200);
    expect(dashRes.text).toContain('Gym Regularity Activity Graph');
    expect(dashRes.text).toContain('52-week attendance contribution calendar');
    expect(dashRes.text).toContain('regularity-cell');

    const attRes = await agent.get('/member/attendance');
    expect(attRes.status).toBe(200);
    expect(attRes.text).toContain('Gym Regularity Activity Graph');
  });

  test('Current-member ownership: Member A cannot view Member B attendance graph', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'jordan.regularity@gymflow.test', password: 'Password123!' });

    // Attempt to tamper with memberId query parameter to access Member B's dashboard
    const tamperRes = await agent.get(`/member/dashboard?memberId=${memberB._id.toString()}`);
    expect(tamperRes.status).toBe(403);
  });

  test('Invalid member ID handling in attendance service throws informative error', async () => {
    await expect(attendanceService.getAttendanceHeatmap('invalid-id-format')).rejects.toThrow(
      'Valid member ID is required for attendance heatmap'
    );
  });
});
