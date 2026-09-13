const {
  calculateAttendanceStreak,
  formatDateString,
  addDays,
  daysBetween,
  daysRemaining
} = require('../../src/utils/dateUtils');

describe('Date Utilities & Streak Calculation', () => {
  test('calculates correct streak for consecutive active days ending today', () => {
    const today = new Date();
    const todayStr = formatDateString(today);
    const yesterdayStr = formatDateString(addDays(today, -1));
    const twoDaysAgoStr = formatDateString(addDays(today, -2));

    const dates = [todayStr, yesterdayStr, twoDaysAgoStr];
    const streak = calculateAttendanceStreak(dates);

    expect(streak).toBe(3);
  });

  test('calculates streak starting yesterday when not yet checked in today', () => {
    const today = new Date();
    const yesterdayStr = formatDateString(addDays(today, -1));
    const twoDaysAgoStr = formatDateString(addDays(today, -2));

    const dates = [yesterdayStr, twoDaysAgoStr];
    const streak = calculateAttendanceStreak(dates);

    expect(streak).toBe(2);
  });

  test('returns 0 streak when last attendance was 3 days ago', () => {
    const today = new Date();
    const threeDaysAgoStr = formatDateString(addDays(today, -3));
    const fourDaysAgoStr = formatDateString(addDays(today, -4));

    const dates = [threeDaysAgoStr, fourDaysAgoStr];
    const streak = calculateAttendanceStreak(dates);

    expect(streak).toBe(0);
  });

  test('returns 0 for empty or invalid attendance arrays', () => {
    expect(calculateAttendanceStreak([])).toBe(0);
    expect(calculateAttendanceStreak(null)).toBe(0);
    expect(calculateAttendanceStreak(undefined)).toBe(0);
  });

  test('daysRemaining accurately computes positive and negative intervals', () => {
    const now = new Date();
    const inFiveDays = addDays(now, 5);
    const fiveDaysAgo = addDays(now, -5);

    expect(daysRemaining(inFiveDays)).toBe(5);
    expect(daysRemaining(fiveDaysAgo)).toBe(-5);
  });
});
