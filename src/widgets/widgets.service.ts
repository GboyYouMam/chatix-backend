import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db } from '../database/database.types';
import * as schema from '../database/scheme';
import { normalizeTrackUrl } from './track-url';
import { utcDay } from './utc-day';
import {
  DEFAULT_WIDGET_LAYOUT,
  WANTED_POSTER_DEBT,
  WIDGET_KEY_SET,
  WIDGET_UNLOCK_ITEMS,
  type WidgetKey,
} from './widget-catalog';

const DAY_MS = 86_400_000;
const AURA_CHART_DAYS = 30;
const TOP_GLAZERS = 5;
const TOP_ROOMS = 3;
const RECENT_MESSAGE_SCAN = 200;
const RAP_SHEET_WARNS = 10;

export interface ProfileWidgets {
  layout: WidgetKey[];
  data: {
    nowPlaying: {
      provider: 'spotify' | 'soundcloud';
      url: string;
      embedUrl: string;
    } | null;
    auraChart: { day: string; aura: number }[];
    fightRecord: {
      wins: number;
      losses: number;
      streak: number;
      last: { opponent: string; won: boolean; at: string } | null;
    };
    topGlazers: { username: string; pfp_url: string | null }[];
    debt: number;
    yapStats: {
      messages: number;
      topRooms: { title: string; count: number }[];
      mostCookedTake: { excerpt: string; replies: number } | null;
    };
    status: { text: string; setAt: string | null } | null;
    rapSheet: {
      warns: { reason: string; createdAt: string }[];
      bans: { reason: string | null; until: string }[];
    };
    hitCount: number;
  };
}

@Injectable()
export class WidgetsService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  async updateLayout(userId: string, layout: string[]) {
    if (layout.some((key) => !WIDGET_KEY_SET.has(key))) {
      throw new BadRequestException('no such widget. nice try.');
    }
    if (new Set(layout).size !== layout.length) {
      throw new BadRequestException('each widget once, chud.');
    }

    const unlockItems = [...new Set(Object.values(WIDGET_UNLOCK_ITEMS).flat())];
    const ownedRows = await this.db
      .select({ itemKey: schema.userInventory.itemKey })
      .from(schema.userInventory)
      .where(
        and(
          eq(schema.userInventory.userId, userId),
          inArray(schema.userInventory.itemKey, unlockItems),
        ),
      );
    const owned = new Set(ownedRows.map((row) => row.itemKey));
    for (const key of layout as WidgetKey[]) {
      const items = WIDGET_UNLOCK_ITEMS[key];
      if (items && !items.some((item) => owned.has(item))) {
        throw new ForbiddenException({
          code: 'WIDGET_LOCKED',
          message: 'locked. buy it first, chud.',
        });
      }
    }

    await this.db
      .update(schema.users)
      .set({ widgetLayout: layout })
      .where(eq(schema.users.id, userId));
    return { layout };
  }

  async updateProfileExtras(
    userId: string,
    data: { trackUrl?: string | null; statusText?: string | null },
  ) {
    const [current] = await this.db
      .select({
        statusText: schema.users.statusText,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!current) throw new BadRequestException('no such chud.');

    const updates: Partial<typeof schema.users.$inferInsert> = {};
    if (data.trackUrl !== undefined) {
      if (data.trackUrl === null) {
        updates.profileTrackUrl = null;
      } else {
        const track = normalizeTrackUrl(data.trackUrl);
        if (!track) {
          throw new BadRequestException(
            'spotify or soundcloud links only, chud.',
          );
        }
        updates.profileTrackUrl = track.canonical;
      }
    }
    if (data.statusText !== undefined) {
      const text = data.statusText?.trim() ?? '';
      if (!text) {
        updates.statusText = null;
        updates.statusSetAt = null;
      } else if (text !== current.statusText) {
        updates.statusText = text;
        updates.statusSetAt = new Date();
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, userId));
    }
    const [saved] = await this.db
      .select({
        profileTrackUrl: schema.users.profileTrackUrl,
        statusText: schema.users.statusText,
        statusSetAt: schema.users.statusSetAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return saved;
  }

  // Counts one view per viewer per UTC day. Returns the post-write total.
  async recordProfileView(
    profileUserId: string,
    viewerId: string,
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(schema.profileViewLog)
        .values({
          userId: profileUserId,
          viewerKey: viewerId,
          day: utcDay(),
        })
        .onConflictDoNothing()
        .returning({ day: schema.profileViewLog.day });
      const [row] = inserted
        ? await tx
            .update(schema.users)
            .set({ profileViews: sql`${schema.users.profileViews} + 1` })
            .where(eq(schema.users.id, profileUserId))
            .returning({ profileViews: schema.users.profileViews })
        : await tx
            .select({ profileViews: schema.users.profileViews })
            .from(schema.users)
            .where(eq(schema.users.id, profileUserId));
      return row?.profileViews ?? 0;
    });
  }

  async forProfile(userId: string, hitCount?: number): Promise<ProfileWidgets> {
    const [row] = await this.db
      .select({
        widgetLayout: schema.users.widgetLayout,
        profileTrackUrl: schema.users.profileTrackUrl,
        statusText: schema.users.statusText,
        statusSetAt: schema.users.statusSetAt,
        profileViews: schema.users.profileViews,
        debt: schema.users.debt,
        messagesCount: schema.users.messagesCount,
        fightsWon: schema.users.fightsWon,
        fightsLost: schema.users.fightsLost,
        winStreak: schema.users.winStreak,
        lossStreak: schema.users.lossStreak,
        bannedUntil: schema.users.bannedUntil,
        banReason: schema.users.banReason,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!row) throw new BadRequestException('no such chud.');

    const now = Date.now();
    const since30Days = new Date(now - 30 * DAY_MS);
    const [auraRows, lastFight, glazers, topRooms, mostCookedTake, warns] =
      await Promise.all([
        this.db
          .select({
            day: schema.auraHistory.day,
            aura: schema.auraHistory.aura,
          })
          .from(schema.auraHistory)
          .where(
            and(
              eq(schema.auraHistory.userId, userId),
              gte(
                schema.auraHistory.day,
                utcDay(new Date(now - (AURA_CHART_DAYS - 1) * DAY_MS)),
              ),
            ),
          )
          .orderBy(asc(schema.auraHistory.day))
          .limit(AURA_CHART_DAYS),
        this.findLastFight(userId),
        this.db
          .select({
            username: schema.users.username,
            pfp_url: schema.users.pfp_url,
          })
          .from(schema.profileRespects)
          .innerJoin(
            schema.users,
            eq(schema.users.id, schema.profileRespects.admirerId),
          )
          .where(eq(schema.profileRespects.profileUserId, userId))
          .orderBy(desc(schema.profileRespects.createdAt))
          .limit(TOP_GLAZERS),
        this.db
          .select({ title: schema.rooms.title, count: count() })
          .from(schema.messages)
          .innerJoin(schema.rooms, eq(schema.rooms.id, schema.messages.roomId))
          .where(
            and(
              eq(schema.messages.authorId, userId),
              eq(schema.messages.isDeleted, false),
              gte(schema.messages.createdAt, since30Days),
            ),
          )
          .groupBy(schema.rooms.id, schema.rooms.title)
          .orderBy(desc(count()))
          .limit(TOP_ROOMS),
        this.findMostCookedTake(userId, since30Days),
        this.db
          .select({
            reason: schema.userWarnings.reason,
            createdAt: schema.userWarnings.createdAt,
          })
          .from(schema.userWarnings)
          .where(
            and(
              eq(schema.userWarnings.userId, userId),
              isNull(schema.userWarnings.revokedAt),
            ),
          )
          .orderBy(desc(schema.userWarnings.createdAt))
          .limit(RAP_SHEET_WARNS),
      ]);

    const rapSheetWarns = warns.map((warn) => ({
      reason: warn.reason,
      createdAt: warn.createdAt.toISOString(),
    }));
    const bans =
      row.bannedUntil && row.bannedUntil.getTime() > now
        ? [{ reason: row.banReason, until: row.bannedUntil.toISOString() }]
        : [];

    const layout: WidgetKey[] = [];
    for (const key of row.widgetLayout ?? DEFAULT_WIDGET_LAYOUT) {
      if (WIDGET_KEY_SET.has(key) && !layout.includes(key as WidgetKey)) {
        layout.push(key as WidgetKey);
      }
    }
    const forceOn = (key: WidgetKey, condition: boolean) => {
      if (condition && !layout.includes(key)) layout.push(key);
    };
    forceOn('rap_sheet', rapSheetWarns.length > 0 || bans.length > 0);
    forceOn('wanted_poster', row.debt >= WANTED_POSTER_DEBT);

    const track = row.profileTrackUrl
      ? normalizeTrackUrl(row.profileTrackUrl)
      : null;

    return {
      layout,
      data: {
        nowPlaying: track
          ? {
              provider: track.provider,
              url: track.canonical,
              embedUrl: track.embedUrl,
            }
          : null,
        auraChart: auraRows,
        fightRecord: {
          wins: row.fightsWon,
          losses: row.fightsLost,
          // Positive while winning, negative while losing.
          streak: row.winStreak > 0 ? row.winStreak : -row.lossStreak,
          last: lastFight,
        },
        topGlazers: glazers,
        debt: row.debt,
        yapStats: {
          messages: row.messagesCount,
          topRooms,
          mostCookedTake,
        },
        status: row.statusText
          ? {
              text: row.statusText,
              setAt: row.statusSetAt?.toISOString() ?? null,
            }
          : null,
        rapSheet: { warns: rapSheetWarns, bans },
        hitCount: hitCount ?? row.profileViews,
      },
    };
  }

  private async findLastFight(userId: string) {
    const [fight] = await this.db
      .select({
        player1Id: schema.fights.player1Id,
        player2Id: schema.fights.player2Id,
        winnerId: schema.fights.winnerId,
        createdAt: schema.fights.createdAt,
      })
      .from(schema.fights)
      .where(
        and(
          or(
            eq(schema.fights.player1Id, userId),
            eq(schema.fights.player2Id, userId),
          ),
          isNotNull(schema.fights.player2Id),
          ne(schema.fights.outcome, 'cancelled'),
        ),
      )
      .orderBy(desc(schema.fights.createdAt))
      .limit(1);
    if (!fight) return null;

    const opponentId =
      fight.player1Id === userId ? fight.player2Id : fight.player1Id;
    const [opponent] = opponentId
      ? await this.db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.id, opponentId))
      : [];
    return {
      opponent: opponent?.username ?? 'someone who left',
      won: fight.winnerId === userId,
      at: fight.createdAt.toISOString(),
    };
  }

  // A reply is a later message in the same room that quotes this message
  // as >>id (first 8 chars of its uuid). Only the 200 newest messages are scanned.
  private async findMostCookedTake(userId: string, since: Date) {
    const rows = await this.db.execute<{
      cipher_text: string;
      replies: number;
    }>(sql`
      SELECT m.cipher_text, (
        SELECT count(*)::int FROM messages r
        WHERE r.room_id = m.room_id
          AND r.is_deleted = false
          AND r.created_at > m.created_at
          AND r.cipher_text LIKE '%>>' || left(m.id::text, 8) || '%'
      ) AS replies
      FROM (
        SELECT id, room_id, cipher_text, created_at FROM messages
        WHERE author_id = ${userId}
          AND is_deleted = false
          AND created_at >= ${since.toISOString()}
        ORDER BY created_at DESC
        LIMIT ${RECENT_MESSAGE_SCAN}
      ) m
      ORDER BY replies DESC, m.created_at DESC
      LIMIT 1
    `);
    const top = rows[0];
    if (!top || Number(top.replies) === 0) return null;
    return {
      excerpt: top.cipher_text.slice(0, 120),
      replies: Number(top.replies),
    };
  }
}
