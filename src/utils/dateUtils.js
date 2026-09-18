function toDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateString(input = new Date()) {
  const d = toDate(input);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(input = new Date()) {
  const d = toDate(input);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(dateA, dateB) {
  const a = normalizeDateOnly(dateA);
  const b = normalizeDateOnly(dateB);
  if (!a || !b) return 0;
  const diffTime = Math.abs(b.getTime() - a.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function daysRemaining(targetDate) {
  const target = normalizeDateOnly(targetDate);
  const today = normalizeDateOnly(new Date());
  if (!target || !today) return 0;
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDateDisplay(input) {
  const d = toDate(input);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTimeDisplay(input) {
  const d = toDate(input);
  if (!d) return 'N/A';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function calculateAttendanceStreak(dateStrings) {
  if (!dateStrings || !Array.isArray(dateStrings) || dateStrings.length === 0) {
    return 0;
  }

  const uniqueDates = Array.from(new Set(dateStrings)).sort().reverse();
  const todayStr = formatDateString(new Date());
  const yesterdayStr = formatDateString(addDays(new Date(), -1));

  // Must have checked in today or yesterday to maintain an active streak
  const firstDate = uniqueDates[0];
  if (firstDate !== todayStr && firstDate !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let expectedDate = firstDate === todayStr ? new Date() : addDays(new Date(), -1);

  for (const dateStr of uniqueDates) {
    const expectedStr = formatDateString(expectedDate);
    if (dateStr === expectedStr) {
      streak += 1;
      expectedDate = addDays(expectedDate, -1);
    } else {
      break;
    }
  }

  return streak;
}

function calculateLongestStreak(dateStrings) {
  if (!dateStrings || !Array.isArray(dateStrings) || dateStrings.length === 0) {
    return 0;
  }

  const uniqueDates = Array.from(new Set(dateStrings)).sort();
  if (uniqueDates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const expectedDate = addDays(prevDate, 1);
    if (formatDateString(expectedDate) === uniqueDates[i]) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

module.exports = {
  toDate,
  formatDateString,
  normalizeDateOnly,
  addDays,
  daysBetween,
  daysRemaining,
  formatDateDisplay,
  formatTimeDisplay,
  calculateAttendanceStreak,
  calculateLongestStreak
};
