import { FightClubRepository } from './fight-club.repository';

describe('FightClubRepository', () => {
  const update = (rows: unknown[]) => ({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });

  it('rolls back when either user is missing', async () => {
    const tx = {
      update: jest
        .fn()
        .mockReturnValueOnce(update([{ id: 'winner' }]))
        .mockReturnValueOnce(update([])),
    };
    const db = { transaction: (callback: (tx: unknown) => unknown) => callback(tx) };
    const repository = new FightClubRepository(db as any);

    await expect(
      repository.summariseFight('winner', 'missing', 'aura', 1),
    ).rejects.toThrow('Loser not found');
  });

  it('rejects invalid stakes and stake types', async () => {
    const db = {
      transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({})),
    };
    const repository = new FightClubRepository(db as any);

    await expect(
      repository.summariseFight('winner', 'loser', 'aura', -1),
    ).rejects.toThrow('positive integer');
    await expect(
      repository.summariseFight('winner', 'loser', 'other' as any, 1),
    ).rejects.toThrow('Unsupported stake type');
  });
});
