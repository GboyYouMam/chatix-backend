import { toAdminUser } from './admin.serializer';
import * as scheme from '../database/scheme';

describe('toAdminUser', () => {
  it('serializes database fields without exposing credentials', () => {
    const user = toAdminUser(
      {
        id: 'id',
        username: 'chud',
        role: 'user',
        pfp_url: 'pfp',
        description: null,
        vibe: null,
        aura: 1,
        debt: 2,
        respectCount: 3,
        isClown: false,
        isMogged: false,
        adminGlazeMode: false,
        canChangeProfile: true,
        forcedTitle: null,
        bannedUntil: null,
        banReason: null,
        autoBannedAt: null,
        yapCooldown: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        password: 'secret',
        tokenVersion: 4,
      } as typeof scheme.users.$inferSelect,
      2,
    );

    expect(user).toMatchObject({
      pfpUrl: 'pfp',
      createdAt: '2026-01-01T00:00:00.000Z',
      activeWarningsCount: 2,
    });
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('tokenVersion');
    expect(Object.keys(user).some((key) => key.includes('_'))).toBe(false);
  });
});
