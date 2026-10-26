import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { StorageService } from '../storage/storage.service';

describe('UsersService', () => {
  it('returns active profile warnings without admin identity', async () => {
    const repository = {
      findPublicByUsername: jest
        .fn()
        .mockResolvedValue({ id: 'u1', respectCount: 2 }),
      findProfileComments: jest.fn().mockResolvedValue([]),
      hasRespectedProfile: jest.fn().mockResolvedValue(false),
      findActiveWarnings: jest
        .fn()
        .mockResolvedValue([
          { reason: 'reason', createdAt: new Date('2026-10-26T00:00:00Z') },
        ]),
    };
    const service = new UsersService(
      repository as unknown as UsersRepository,
      {} as StorageService,
    );

    const profile = await service.findByUsername('user');

    expect(profile.activeWarnings).toEqual([
      { reason: 'reason', createdAt: '2026-10-26T00:00:00.000Z' },
    ]);
    expect(profile.activeWarnings[0]).not.toHaveProperty('adminId');
    expect(profile.respectCount).toBe(2);
  });

  it('farms aura through the atomic repository increment', async () => {
    const farmAura = jest.fn().mockResolvedValue({ aura: 1001 });
    const service = new UsersService(
      { farmAura } as unknown as UsersRepository,
      {} as StorageService,
    );

    await expect(service.auraFarming('u1')).resolves.toMatchObject({
      aura: 1001,
    });
    expect(farmAura).toHaveBeenCalledWith('u1');
  });
});
