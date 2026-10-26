export const AUTOBAN_THRESHOLD = 3;
export const AUTOBAN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTOBAN_REASON = 'autoban: 3 warns. ur cooked.';

export function computeAutoban(
  activeWarnings: number,
  currentBannedUntil: Date | null,
  now: Date,
): { bannedUntil: Date } | null {
  if (activeWarnings < AUTOBAN_THRESHOLD) return null;
  const proposed = new Date(now.getTime() + AUTOBAN_DURATION_MS);
  return {
    bannedUntil:
      currentBannedUntil && currentBannedUntil > proposed
        ? currentBannedUntil
        : proposed,
  };
}
