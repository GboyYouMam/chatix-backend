import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db } from '../database/database.types';
import * as schema from '../database/scheme';
import { addUtcDays, utcWeekStart } from './utc-time';

const TOP_N = 10;

export type LeaderboardWeek = 'current' | 'previous';

export interface LeaderboardEntry {
  username: string;
  pfp_url: string | null;
  value: number;
}

export interface LeaderboardResult {
  week: { start: string; end: string };
  mostAura: LeaderboardEntry[];
  mostDebt: LeaderboardEntry[];
  mostMogged: LeaderboardEntry[];
}

@Injectable()
export class LeaderboardService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  async get(
    week: LeaderboardWeek,
    now = new Date(),
  ): Promise<LeaderboardResult> {
    const currentStart = utcWeekStart(now);
    const start =
      week === 'previous' ? addUtcDays(currentStart, -7) : currentStart;
    const end = addUtcDays(start, 7);

    const [mostAura, mostDebt, mostMogged] = await Promise.all([
      this.db
        .select({
          username: schema.users.username,
          pfp_url: schema.users.pfp_url,
          value: schema.users.aura,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.aura), asc(schema.users.id))
        .limit(TOP_N),
      this.db
        .select({
          username: schema.users.username,
          pfp_url: schema.users.pfp_url,
          value: schema.users.debt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.debt), asc(schema.users.id))
        .limit(TOP_N),
      this.mostMogged(start, end),
    ]);

    return {
      week: { start: start.toISOString(), end: end.toISOString() },
      mostAura,
      mostDebt,
      mostMogged,
    };
  }

  // A loss is a finished fight (ko or rage_quit) with a winner; the loser is
  // the other player.
  private async mostMogged(
    start: Date,
    end: Date,
  ): Promise<LeaderboardEntry[]> {
    const rows = await this.db.execute<{
      username: string;
      pfp_url: string | null;
      value: number;
    }>(sql`
      SELECT u.username, u.pfp_url, l.losses::int AS value
      FROM (
        SELECT loser_id, count(*) AS losses
        FROM (
          SELECT CASE WHEN f.winner_id = f.player1_id THEN f.player2_id ELSE f.player1_id END AS loser_id
          FROM ${schema.fights} f
          WHERE f.outcome IN ('ko', 'rage_quit')
            AND f.winner_id IS NOT NULL
            AND f.created_at >= ${start.toISOString()}::timestamptz
            AND f.created_at < ${end.toISOString()}::timestamptz
        ) losses_raw
        WHERE loser_id IS NOT NULL
        GROUP BY loser_id
        ORDER BY losses DESC, loser_id ASC
        LIMIT ${TOP_N}
      ) l
      JOIN ${schema.users} u ON u.id = l.loser_id
      ORDER BY l.losses DESC, u.id ASC
    `);
    return Array.from(rows, (row) => ({
      username: row.username,
      pfp_url: row.pfp_url,
      value: row.value,
    }));
  }
}
