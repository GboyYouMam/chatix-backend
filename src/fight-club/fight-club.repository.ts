import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { recordAuraSnapshot } from '../widgets/aura-history';
import type { StakeVaries } from './types/types';

@Injectable()
export class FightClubRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof scheme>,
  ) {}

  async settle(
    winnerId: string,
    loserId: string,
    stakeType: StakeVaries,
    stakeAmount: number,
    match: { player1Id: string; player2Id: string },
    outcome: 'ko' | 'rage_quit',
  ): Promise<void> {
    if (!Number.isInteger(stakeAmount) || stakeAmount <= 0) {
      throw new Error('Stake amount must be a positive integer');
    }

    await this.db.transaction(async (tx) => {
      switch (stakeType) {
        case 'aura': {
          const winner = await tx
            .update(scheme.users)
            .set({
              aura: sql`${scheme.users.aura} + ${stakeAmount}`,
              fightTitle: 'true adam',
              fightTitleUntil: new Date(Date.now() + 86400000),
            })
            .where(eq(scheme.users.id, winnerId))
            .returning({ id: scheme.users.id, aura: scheme.users.aura });
          if (winner.length !== 1) throw new Error('Winner not found');
          await recordAuraSnapshot(tx, winnerId, winner[0].aura);

          const loser = await tx
            .update(scheme.users)
            .set({
              aura: sql`${scheme.users.aura} - ${stakeAmount}`,
              fightTitle: 'sub5',
              fightTitleUntil: new Date(Date.now() + 86400000),
            })
            .where(eq(scheme.users.id, loserId))
            .returning({ id: scheme.users.id, aura: scheme.users.aura });
          if (loser.length !== 1) throw new Error('Loser not found');
          await recordAuraSnapshot(tx, loserId, loser[0].aura);
          break;
        }
        case 'debt': {
          const winner = await tx
            .update(scheme.users)
            .set({
              debt: sql`${scheme.users.debt} - ${stakeAmount}`,
              fightTitle: 'true adam',
              fightTitleUntil: new Date(Date.now() + 86400000),
            })
            .where(eq(scheme.users.id, winnerId))
            .returning({ id: scheme.users.id });
          if (winner.length !== 1) throw new Error('Winner not found');

          const loser = await tx
            .update(scheme.users)
            .set({
              debt: sql`${scheme.users.debt} + ${stakeAmount}`,
              fightTitle: 'sub5',
              fightTitleUntil: new Date(Date.now() + 86400000),
            })
            .where(eq(scheme.users.id, loserId))
            .returning({ id: scheme.users.id });
          if (loser.length !== 1) throw new Error('Loser not found');
          break;
        }
        default:
          throw new Error('Unsupported stake type');
      }
      await tx
        .update(scheme.users)
        .set({
          fightsWon: sql`${scheme.users.fightsWon} + 1`,
          winStreak: sql`${scheme.users.winStreak} + 1`,
          lossStreak: 0,
        })
        .where(eq(scheme.users.id, winnerId));
      await tx
        .update(scheme.users)
        .set({
          fightsLost: sql`${scheme.users.fightsLost} + 1`,
          lossStreak: sql`${scheme.users.lossStreak} + 1`,
          winStreak: 0,
        })
        .where(eq(scheme.users.id, loserId));
      await tx.insert(scheme.fights).values({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        winnerId,
        stakeType,
        stakeAmount,
        outcome,
      });
    });
  }

  async recordCancelled(match: {
    player1Id: string;
    player2Id?: string;
    stakeType: StakeVaries;
    stakeAmount: number;
  }) {
    await this.db.insert(scheme.fights).values({
      player1Id: match.player1Id,
      player2Id: match.player2Id ?? null,
      winnerId: null,
      stakeType: match.stakeType,
      stakeAmount: match.stakeAmount,
      outcome: 'cancelled',
    });
  }

  async countRecentFights(userId: string) {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scheme.fights)
      .where(
        and(
          gte(scheme.fights.createdAt, new Date(Date.now() - 3600000)),
          or(
            eq(scheme.fights.player1Id, userId),
            eq(scheme.fights.player2Id, userId),
          ),
          sql`${scheme.fights.outcome} <> 'cancelled'`,
        ),
      );
    return total;
  }

  async isClown(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(scheme.users.id, userId),
      columns: { isClown: true },
    });
    return user?.isClown ?? false;
  }
}
