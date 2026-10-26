import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const repo = { findByUsername: jest.fn(), create: jest.fn() };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  beforeEach(async () => {
    jest.clearAllMocks();
    service = (
      await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: UsersRepository, useValue: repo },
          { provide: JwtService, useValue: jwt },
          {
            provide: UsersService,
            useValue: { recordLogin: jest.fn().mockResolvedValue(undefined) },
          },
        ],
      }).compile()
    ).get(AuthService);
  });
  it('rejects a bad password', async () => {
    repo.findByUsername.mockResolvedValue({
      id: 'u',
      username: 'user',
      password: 'hash',
    });
    await expect(service.login('user', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('includes token version in signed credentials on registration', async () => {
    repo.findByUsername.mockResolvedValue(null);
    repo.create.mockResolvedValue({
      id: 'u',
      username: 'good_user',
      role: 'user',
      tokenVersion: 3,
    });
    await service.register('good_user', 'Password1!');
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ tv: 3 }));
  });
  it('rejects login for an actively banned account after password check', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    repo.findByUsername.mockResolvedValue({
      id: 'u',
      username: 'user',
      password: 'hash',
      bannedUntil: new Date(Date.now() + 60000),
      banReason: 'lol',
    });
    await expect(service.login('user', 'correct')).rejects.toMatchObject({
      response: { code: 'BANNED', banReason: 'lol' },
    });
  });
});
