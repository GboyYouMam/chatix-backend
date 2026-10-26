import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { AUTOBAN_REASON, computeAutoban } from './autoban';

export interface AdminPageOptions {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateAuditLogData {
  adminId?: string;
  action: string;
  actionKey: string;
  method: string;
  path: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  statusCode: number;
  success: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
}

@Injectable()
export class AdminRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof scheme>,
  ) {}

  async findUser(userId: string) {
    return this.db.query.users.findFirst({
      where: eq(scheme.users.id, userId),
    });
  }

  async findRoom(roomId: string) {
    return this.db.query.rooms.findFirst({
      where: eq(scheme.rooms.id, roomId),
    });
  }

  async countActiveWarnings(userIds: string[]) {
    if (!userIds.length) return new Map<string, number>();
    const rows = await this.db
      .select({ userId: scheme.userWarnings.userId, total: count() })
      .from(scheme.userWarnings)
      .where(
        and(
          inArray(scheme.userWarnings.userId, userIds),
          isNull(scheme.userWarnings.revokedAt),
        ),
      )
      .groupBy(scheme.userWarnings.userId);
    return new Map(rows.map(({ userId, total }) => [userId, total]));
  }

  async countRoomMessages(roomId: string) {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scheme.messages)
      .where(eq(scheme.messages.roomId, roomId));
    return total;
  }

  async quarantineRoom(roomId: string, reason: string) {
    const [room] = await this.db
      .update(scheme.rooms)
      .set({ status: 'quarantined', statusReason: reason })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return room;
  }

  async unquarantineRoom(roomId: string) {
    const [room] = await this.db
      .update(scheme.rooms)
      .set({ status: 'active', statusReason: null })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return room;
  }

  async updateModifiers(
    userId: string,
    modifiers: Partial<typeof scheme.users.$inferInsert> & {
      auraDelta?: number;
      debtDelta?: number;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const { auraDelta, debtDelta, ...fields } = modifiers;
      const updates = {
        ...fields,
        ...(auraDelta !== undefined
          ? { aura: sql`${scheme.users.aura} + ${auraDelta}` }
          : {}),
        ...(debtDelta !== undefined
          ? { debt: sql`${scheme.users.debt} + ${debtDelta}` }
          : {}),
        ...(fields.bannedUntil && fields.bannedUntil > new Date()
          ? { tokenVersion: sql`${scheme.users.tokenVersion} + 1` }
          : {}),
      };
      const [updatedUser] = await tx
        .update(scheme.users)
        .set(updates)
        .where(eq(scheme.users.id, userId))
        .returning();
      return updatedUser;
    });
  }

  async createWarning(userId: string, adminId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const [currentUser] = await tx
        .select()
        .from(scheme.users)
        .where(eq(scheme.users.id, userId))
        .limit(1);
      if (!currentUser) return null;

      const [warning] = await tx
        .insert(scheme.userWarnings)
        .values({ userId, adminId, reason })
        .returning();
      const [{ activeWarnings }] = await tx
        .select({ activeWarnings: count() })
        .from(scheme.userWarnings)
        .where(
          and(
            eq(scheme.userWarnings.userId, userId),
            isNull(scheme.userWarnings.revokedAt),
          ),
        );
      const now = new Date();
      const autoBan = computeAutoban(
        activeWarnings,
        currentUser.bannedUntil,
        now,
      );
      const autoBanned = Boolean(
        autoBan &&
        (!currentUser.bannedUntil ||
          autoBan.bannedUntil > currentUser.bannedUntil),
      );
      const [user] = await tx
        .update(scheme.users)
        .set({
          warnsCount: activeWarnings,
          ...(autoBanned
            ? {
                bannedUntil: autoBan?.bannedUntil,
                banReason: AUTOBAN_REASON,
                autoBannedAt: now,
                tokenVersion: sql`${scheme.users.tokenVersion} + 1`,
              }
            : {}),
        })
        .where(eq(scheme.users.id, userId))
        .returning();
      return { warning, user, autoBanned };
    });
  }

  async revokeWarning(userId: string, warningId: string) {
    return this.db.transaction(async (tx) => {
      const [warning] = await tx
        .update(scheme.userWarnings)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(scheme.userWarnings.id, warningId),
            eq(scheme.userWarnings.userId, userId),
            isNull(scheme.userWarnings.revokedAt),
          ),
        )
        .returning();
      if (!warning) return null;

      const [{ activeWarnings }] = await tx
        .select({ activeWarnings: count() })
        .from(scheme.userWarnings)
        .where(
          and(
            eq(scheme.userWarnings.userId, userId),
            isNull(scheme.userWarnings.revokedAt),
          ),
        );
      await tx
        .update(scheme.users)
        .set({ warnsCount: activeWarnings })
        .where(eq(scheme.users.id, userId));
      return warning;
    });
  }

  async findUsers(options: AdminPageOptions) {
    const where = options.search
      ? ilike(scheme.users.username, `%${options.search}%`)
      : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db.query.users.findMany({
        where,
        columns: { password: false },
        orderBy: [desc(scheme.users.created_at)],
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
      }),
      this.db.select({ total: count() }).from(scheme.users).where(where),
    ]);
    const warnings = await this.countActiveWarnings(items.map(({ id }) => id));
    return {
      items: items.map((user) => ({
        ...user,
        activeWarningsCount: warnings.get(user.id) ?? 0,
      })),
      total,
    };
  }

  async findRooms(options: AdminPageOptions) {
    const where = options.search
      ? or(
          ilike(scheme.rooms.title, `%${options.search}%`),
          ilike(scheme.rooms.topic, `%${options.search}%`),
        )
      : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db.query.rooms.findMany({
        where,
        orderBy: [desc(scheme.rooms.createdAt)],
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        with: { creator: { columns: { id: true, username: true } } },
      }),
      this.db.select({ total: count() }).from(scheme.rooms).where(where),
    ]);
    return { items, total };
  }

  async findMessages(
    options: AdminPageOptions & { room?: string; user?: string },
  ) {
    const where = and(
      options.search
        ? ilike(scheme.messages.cipherText, `%${options.search}%`)
        : undefined,
      options.room ? ilike(scheme.rooms.title, `%${options.room}%`) : undefined,
      options.user
        ? ilike(scheme.users.username, `%${options.user}%`)
        : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          message: scheme.messages,
          author: scheme.users,
          room: scheme.rooms,
        })
        .from(scheme.messages)
        .innerJoin(scheme.users, eq(scheme.users.id, scheme.messages.authorId))
        .innerJoin(scheme.rooms, eq(scheme.rooms.id, scheme.messages.roomId))
        .where(where)
        .orderBy(desc(scheme.messages.createdAt))
        .limit(options.limit)
        .offset((options.page - 1) * options.limit),
      this.db
        .select({ total: count() })
        .from(scheme.messages)
        .innerJoin(scheme.users, eq(scheme.users.id, scheme.messages.authorId))
        .innerJoin(scheme.rooms, eq(scheme.rooms.id, scheme.messages.roomId))
        .where(where),
    ]);
    const items = rows.map(({ message, author, room }) => ({
      ...message,
      author: {
        id: author.id,
        username: author.username,
        pfp_url: author.pfp_url,
        forcedTitle: author.forcedTitle,
        isMogged: author.isMogged,
      },
      room: { id: room.id, title: room.title },
    }));
    return { items, total };
  }

  async findWarnings(userId: string, options: AdminPageOptions) {
    const where = and(
      eq(scheme.userWarnings.userId, userId),
      options.search
        ? ilike(scheme.userWarnings.reason, `%${options.search}%`)
        : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      this.db.query.userWarnings.findMany({
        where,
        orderBy: [desc(scheme.userWarnings.createdAt)],
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        with: { admin: { columns: { id: true, username: true } } },
      }),
      this.db.select({ total: count() }).from(scheme.userWarnings).where(where),
    ]);
    return { items, total };
  }

  async createAuditLog(data: CreateAuditLogData) {
    const [{ id }] = await this.db
      .insert(scheme.adminAuditLogs)
      .values(data)
      .returning({ id: scheme.adminAuditLogs.id });
    // Same shape as findAuditLogs, so live feed entries carry the admin username.
    return this.db.query.adminAuditLogs.findFirst({
      where: eq(scheme.adminAuditLogs.id, id),
      with: { admin: { columns: { id: true, username: true } } },
    });
  }

  async findAuditLogs(options: AdminPageOptions) {
    const where = options.search
      ? or(
          ilike(scheme.adminAuditLogs.action, `%${options.search}%`),
          ilike(scheme.adminAuditLogs.path, `%${options.search}%`),
          ilike(scheme.adminAuditLogs.targetId, `%${options.search}%`),
        )
      : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db.query.adminAuditLogs.findMany({
        where,
        orderBy: [desc(scheme.adminAuditLogs.createdAt)],
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        with: { admin: { columns: { id: true, username: true } } },
      }),
      this.db
        .select({ total: count() })
        .from(scheme.adminAuditLogs)
        .where(where),
    ]);
    return { items, total };
  }
}
