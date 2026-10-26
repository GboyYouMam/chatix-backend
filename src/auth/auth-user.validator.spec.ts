import { UnauthorizedException } from '@nestjs/common';
import { AuthUserValidator } from './auth-user.validator';

describe('AuthUserValidator', () => {
  const authState = {
    id: 'u',
    username: 'db-name',
    role: 'user' as const,
    tokenVersion: 0,
    bannedUntil: null,
    banReason: null,
  };
  const users = { findAuthState: jest.fn() };
  const validator = new AuthUserValidator(users as never);
  beforeEach(() => {
    users.findAuthState.mockReset().mockResolvedValue(authState);
  });
  it('rejects missing users and stale token versions', async () => {
    users.findAuthState.mockResolvedValueOnce(null);
    await expect(
      validator.validate({ sub: 'u', username: '', role: 'user' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    users.findAuthState.mockResolvedValueOnce({
      ...authState,
      tokenVersion: 2,
    });
    await expect(
      validator.validate({ sub: 'u', username: '', role: 'user', tv: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('accepts legacy tokens at version zero and trusts role and username from the database', async () => {
    await expect(
      validator.validate({ sub: 'u', username: 'token-name', role: 'admin' }),
    ).resolves.toEqual({ userId: 'u', username: 'db-name', role: 'user' });
  });
  it('blocks active bans and permits expired bans', async () => {
    users.findAuthState.mockResolvedValueOnce({
      ...authState,
      bannedUntil: new Date(Date.now() + 60000),
      banReason: 'lol',
    });
    await expect(
      validator.validate({ sub: 'u', username: '', role: 'user' }),
    ).rejects.toMatchObject({ response: { code: 'BANNED', banReason: 'lol' } });
    users.findAuthState.mockResolvedValueOnce({
      ...authState,
      bannedUntil: new Date(Date.now() - 60000),
    });
    await expect(
      validator.validate({ sub: 'u', username: '', role: 'user' }),
    ).resolves.toBeDefined();
  });
});
