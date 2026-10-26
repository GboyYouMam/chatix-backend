import { AUTOBAN_DURATION_MS, computeAutoban } from './autoban';

describe('computeAutoban', () => {
  const now = new Date('2026-10-26T00:00:00Z');

  it('bans at three active warnings for seven days without shortening a longer ban', () => {
    expect(computeAutoban(2, null, now)).toBeNull();
    expect(computeAutoban(3, null, now)?.bannedUntil.getTime()).toBe(
      now.getTime() + AUTOBAN_DURATION_MS,
    );
    const longerBan = new Date(now.getTime() + 30 * 86400000);
    expect(computeAutoban(3, longerBan, now)?.bannedUntil).toBe(longerBan);
    expect(
      computeAutoban(
        4,
        new Date(now.getTime() - 86400000),
        now,
      )?.bannedUntil.getTime(),
    ).toBe(now.getTime() + AUTOBAN_DURATION_MS);
  });
});
