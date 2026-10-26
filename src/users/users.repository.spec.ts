import { DbOrTx } from '../database/database.types';
import { UsersRepository } from './users.repository';

describe('UsersRepository.bumpTokenVersion', () => {
  function fakeDb() {
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    return { db: { update } as unknown as DbOrTx, update, set, where };
  }

  it('uses the supplied transaction', async () => {
    const { db, update } = fakeDb();
    const { db: tx, update: txUpdate, set, where } = fakeDb();
    const repository = new UsersRepository(db as never);

    await repository.bumpTokenVersion('user-id', tx);

    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
