import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { inArray, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as scheme from '../database/scheme';
import { FightClubRepository } from './fight-club.repository';

describe('FightClubRepository', () => {
  const update = (rows: unknown[], setCalls: Record<string, unknown>[]) => ({
    set: jest.fn((values: Record<string, unknown>) => {
      setCalls.push(values);
      return {
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(rows),
        }),
      };
    }),
  });

  it('settles both players with atomic SQL increments in one transaction', async () => {
    const setCalls: Record<string, unknown>[] = [];
    const tx = {
      update: jest
        .fn()
        .mockReturnValueOnce(update([{ id: 'winner' }], setCalls))
        .mockReturnValueOnce(update([{ id: 'loser' }], setCalls))
        .mockReturnValueOnce(update([], setCalls))
        .mockReturnValueOnce(update([], setCalls)),
      insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue([]) })),
    };
    const transaction = jest.fn((callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );
    const db = { transaction } as unknown as PostgresJsDatabase<typeof scheme>;
    const repository = new FightClubRepository(db);

    await repository.settle(
      'winner',
      'loser',
      'aura',
      50,
      { player1Id: 'winner', player2Id: 'loser' },
      'ko',
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(4);
    expect(setCalls).toHaveLength(4);
    const winnerAura = setCalls[0].aura;
    const loserAura = setCalls[1].aura;
    expect(winnerAura).toBeInstanceOf(SQL);
    expect(loserAura).toBeInstanceOf(SQL);
    const winnerQuery = new PgDialect().sqlToQuery(winnerAura as SQL);
    const loserQuery = new PgDialect().sqlToQuery(loserAura as SQL);
    expect(winnerQuery.sql).toContain('+');
    expect(loserQuery.sql).toContain('-');
    expect(winnerQuery.sql + loserQuery.sql).not.toContain('GREATEST');
    expect(winnerQuery.params).toContain(50);
    expect(loserQuery.params).toContain(50);
  });
});
const testDatabaseUrl = process.env.DATABASE_URL_TEST;
const databaseSuite = testDatabaseUrl ? describe : describe.skip;

databaseSuite('FightClubRepository PostgreSQL', () => {
  let connection: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof scheme>>;
  let repository: FightClubRepository;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('DATABASE_URL_TEST is required');
    connection = postgres(testDatabaseUrl);
    db = drizzle(connection, { schema: scheme });
    await migrate(db, { migrationsFolder: './drizzle' });
    repository = new FightClubRepository(db);
  });

  afterAll(async () => {
    await connection?.end();
  });

  it('allows the loser aura to fall below zero', async () => {
    const suffix = randomUUID().slice(0, 8);
    const inserted = await db
      .insert(scheme.users)
      .values([
        { username: `fc-w-${suffix}`, password: 'test', aura: 0 },
        { username: `fc-l-${suffix}`, password: 'test', aura: 10 },
      ])
      .returning({ id: scheme.users.id });
    const winner = inserted[0];
    const loser = inserted[1];
    if (!winner || !loser) throw new Error('expected test users');

    try {
      await repository.settle(
        winner.id,
        loser.id,
        'aura',
        50,
        { player1Id: winner.id, player2Id: loser.id },
        'ko',
      );
      const balances = await db
        .select({ id: scheme.users.id, aura: scheme.users.aura })
        .from(scheme.users)
        .where(inArray(scheme.users.id, [winner.id, loser.id]));

      expect(balances).toEqual(
        expect.arrayContaining([
          { id: winner.id, aura: 50 },
          { id: loser.id, aura: -40 },
        ]),
      );
    } finally {
      await db
        .delete(scheme.users)
        .where(inArray(scheme.users.id, [winner.id, loser.id]));
    }
  });
});
