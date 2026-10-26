import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { UsersRepository } from '../users/users.repository';
import { MessagesRepository } from '../messages/messages.repository';
import { RealtimeService } from '../realtime/realtime.service';

describe('AdminService', () => {
  let service: AdminService;
  const realtime = {
    emitToAdmins: jest.fn(),
    emitToUser: jest.fn(),
    emitToRoom: jest.fn(),
    disconnectUser: jest.fn(),
  };
  const usersRepository = { vaporizeUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: {} },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: MessagesRepository, useValue: {} },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('emits the ban before disconnecting sockets during vaporize', async () => {
    usersRepository.vaporizeUser.mockResolvedValue({ id: 'user-id' });
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
