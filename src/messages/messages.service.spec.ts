import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RequestUser } from '../auth/dto/request-user.dto';
import { RoomService } from '../rooms/room/room.service';
import { ConfigService } from '@nestjs/config';
import { AchievementsService } from '../achievements/achievements.service';
import { CosmeticsService } from '../shop/cosmetics.service';

describe('MessagesService', () => {
  it('rejects more than five attachments', async () => {
    const service = new MessagesService(
      {} as MessagesRepository,
      {} as StorageService,
      {} as RealtimeService,
      {} as RoomService,
      {} as ConfigService,
      {} as AchievementsService,
      {} as CosmeticsService,
    );

    await expect(
      service.sendMessage(
        'room',
        'user',
        '',
        undefined,
        Array(6) as Express.Multer.File[],
      ),
    ).rejects.toThrow('at most 5 files');
  });

  it('broadcasts message deletion to the room and admins', async () => {
    const repository = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'm1', roomId: 'r1', authorId: 'u1' }),
      deleteMessage: jest.fn().mockResolvedValue({ id: 'm1', roomId: 'r1' }),
    };
    const realtime = {
      emitToRoom: jest.fn(),
      emitToAdmins: jest.fn(),
    };
    const service = new MessagesService(
      repository as unknown as MessagesRepository,
      {} as StorageService,
      realtime as unknown as RealtimeService,
      {} as RoomService,
      {} as ConfigService,
      {} as AchievementsService,
      {} as CosmeticsService,
    );

    await service.deleteMessage('m1', {
      userId: 'admin',
      role: 'admin',
    } as RequestUser);

    expect(realtime.emitToRoom).toHaveBeenCalledWith('r1', 'messageDeleted', {
      id: 'm1',
    });
    expect(realtime.emitToAdmins).toHaveBeenCalledWith(
      'admin:message_deleted',
      { id: 'm1' },
    );
  });
});
