const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Weeks start Monday 00:00 UTC.
export function utcWeekStart(date: Date): Date {
  const dayStart = utcDayStart(date);
  const sinceMonday = (dayStart.getUTCDay() + 6) % 7;
  return addUtcDays(dayStart, -sinceMonday);
}
