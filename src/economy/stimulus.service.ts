import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db } from '../database/database.types';
import * as schema from '../database/scheme';
import { addUtcDays, utcDayStart } from './utc-time';

const BASE_AMOUNT = 10;
const STEP_AMOUNT = 5;
const MAX_AMOUNT = 50;

export function stimulusAmount(streak: number): number {
  return Math.min(BASE_AMOUNT + STEP_AMOUNT * (streak - 1), MAX_AMOUNT);
}

export interface StimulusResult {
  granted: boolean;
  amount: number;
  streak: number;
  nextAt: string;
  streakReset?: true;
}

@Injectable()
export class StimulusService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  // The user row is locked for the transaction, and the grant is a single
  // UPDATE guarded by "no claim yet today (UTC)", so concurrent calls grant once.
  async claim(userId: string, now = new Date()): Promise<StimulusResult> {
    const todayStart = utcDayStart(now);
    const yesterdayStart = addUtcDays(todayStart, -1);
    const nextAt = addUtcDays(todayStart, 1).toISOString();

    return this.db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ streak: schema.users.stimulusStreak })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .for('update');
      if (!previous) throw new NotFoundException('no such chud.');

      const { stimulusStreak, lastStimulusAt } = schema.users;
      const nextStreak = sql`CASE WHEN ${lastStimulusAt} >= ${yesterdayStart.toISOString()}::timestamptz THEN ${stimulusStreak} + 1 ELSE 1 END`;
      const [claimed] = await tx
        .update(schema.users)
        .set({
          stimulusStreak: nextStreak,
          aura: sql`${schema.users.aura} + LEAST(${sql.raw(String(BASE_AMOUNT))} + ${sql.raw(String(STEP_AMOUNT))} * (${nextStreak} - 1), ${sql.raw(String(MAX_AMOUNT))})`,
          lastStimulusAt: now,
        })
        .where(
          and(
            eq(schema.users.id, userId),
            or(isNull(lastStimulusAt), lt(lastStimulusAt, todayStart)),
          ),
        )
        .returning({ streak: schema.users.stimulusStreak });

      if (!claimed) {
        return {
          granted: false,
          amount: 0,
          streak: previous.streak,
          nextAt,
        };
      }
      const streakReset = claimed.streak === 1 && previous.streak > 0;
      return {
        granted: true,
        amount: stimulusAmount(claimed.streak),
        streak: claimed.streak,
        nextAt,
        ...(streakReset ? { streakReset: true as const } : {}),
      };
    });
  }
}
