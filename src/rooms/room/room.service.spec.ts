import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomService } from './room.service';
import { RoomsRepository } from './rooms.repository';
import { RealtimeService } from '../../realtime/realtime.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { AdminAuditContext } from '../../admin/audit-context';

type RepoMock = {
  getUserValidationData: jest.Mock;
  create: jest.Mock;
  findById: jest.Mock;
  checkAccess: jest.Mock;
  getUserAgeConfirmedAt: jest.Mock;
};

function setup(options: { autoApprove?: boolean } = {}) {
  const repo: RepoMock = {
    getUserValidationData: jest
      .fn()
      .mockResolvedValue({ bannedUntil: null, debt: 0 }),
    create: jest.fn(async (data: unknown) => ({
      id: 'r1',
      ...(data as object),
    })),
    findById: jest.fn(),
    checkAccess: jest.fn(),
    getUserAgeConfirmedAt: jest.fn().mockResolvedValue(null),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'ROOMS_AUTO_APPROVE' ? (options.autoApprove ?? true) : undefined,
    ),
  };
  const service = new RoomService(
    repo as unknown as RoomsRepository,
    {} as RealtimeService,
    {} as AchievementsService,
    {} as AdminAuditContext,
    config as unknown as ConfigService,
  );
  return { service, repo };
}

const baseDto = {
  title: 'late night study',
  topic: 'calc homework',
  publicity: 'public' as const,
};

describe('RoomService.createRoom moderation', () => {
  it('auto-approves a clean room when the flag is on', async () => {
    const { service, repo } = setup({ autoApprove: true });

    await service.createRoom('u1', baseDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', statusReason: null }),
    );
  });

  it('keeps a clean room in checkout when the flag is off', async () => {
    const { service, repo } = setup({ autoApprove: false });

    await service.createRoom('u1', baseDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'checkout' }),
    );
  });

  it('sends a blocked room to checkout with the filter reason', async () => {
    const { service, repo } = setup({ autoApprove: true });

    await service.createRoom('u1', {
      ...baseDto,
      description: 'anyone selling weed?',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'checkout',
        statusReason:
          'auto-filter flagged "selling weed". a human will look at it.',
      }),
    );
  });

  it('forces isNsfw for mature text even when the dto says false', async () => {
    const { service, repo } = setup();

    await service.createRoom('u1', {
      ...baseDto,
      topic: 'weed growing tips',
      isNsfw: false,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isNsfw: true, status: 'active' }),
    );
  });
});

describe('RoomService.assertCanAccess age gate', () => {
  const nsfwRoom = {
    id: 'r1',
    creatorId: 'owner',
    publicity: 'public',
    isNsfw: true,
  };

  it('rejects an unconfirmed user with AGE_GATE', async () => {
    const { service, repo } = setup();
    repo.findById.mockResolvedValue(nsfwRoom);
    repo.getUserAgeConfirmedAt.mockResolvedValue(null);

    const error = await service
      .assertCanAccess('r1', 'u1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      code: 'AGE_GATE',
      message: "age gate: confirm you're 18+ first",
    });
  });

  it('lets a confirmed user into an nsfw room', async () => {
    const { service, repo } = setup();
    repo.findById.mockResolvedValue(nsfwRoom);
    repo.getUserAgeConfirmedAt.mockResolvedValue(new Date());

    await expect(service.assertCanAccess('r1', 'u1')).resolves.toBeUndefined();
  });

  it('never gates a non-nsfw room', async () => {
    const { service, repo } = setup();
    repo.findById.mockResolvedValue({ ...nsfwRoom, isNsfw: false });

    await expect(service.assertCanAccess('r1', 'u1')).resolves.toBeUndefined();
    expect(repo.getUserAgeConfirmedAt).not.toHaveBeenCalled();
  });
});
