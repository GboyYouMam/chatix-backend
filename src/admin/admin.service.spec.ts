import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { UsersRepository } from '../users/users.repository';
import { MessagesRepository } from '../messages/messages.repository';
import { RealtimeService } from '../realtime/realtime.service';
import { AchievementsService } from '../achievements/achievements.service';

describe('AdminService', () => {
  let service: AdminService;
  const realtime = {
    emitToAdmins: jest.fn(),
    emitToUser: jest.fn(),
    emitToRoom: jest.fn(),
    disconnectUser: jest.fn(),
  };
  const usersRepository = { vaporizeUser: jest.fn() };
  const adminRepository = {
    countActiveWarnings: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: adminRepository },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: MessagesRepository, useValue: {} },
        { provide: RealtimeService, useValue: realtime },
        {
          provide: AchievementsService,
          useValue: {
            grantSafely: jest.fn().mockResolvedValue(false),
            evaluate: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('emits the ban before disconnecting sockets during vaporize', async () => {
    usersRepository.vaporizeUser.mockResolvedValue({
      id: 'user-id',
      username: 'gone',
      role: 'user',
      pfp_url: null,
      description: null,
      vibe: null,
      aura: 0,
      debt: 0,
      respectCount: 0,
      isClown: true,
      isMogged: false,
      adminGlazeMode: false,
      canChangeProfile: true,
      forcedTitle: null,
      bannedUntil: null,
      banReason: null,
      autoBannedAt: null,
      yapCooldown: null,
      created_at: new Date(),
      password: 'secret',
      tokenVersion: 0,
    });
    await service.vaporizeUser('user-id');
    expect(realtime.emitToUser).toHaveBeenCalledWith('user-id', 'user:banned', {
      bannedUntil: null,
      banReason: 'vaporized',
    });
    expect(realtime.emitToUser.mock.invocationCallOrder[0]).toBeLessThan(
      realtime.disconnectUser.mock.invocationCallOrder[0],
    );
  });
});
