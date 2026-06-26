import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';

export interface AdminPageOptions {
  page: number;
  limit: number;
  search?: string;
}

export interface CreateAuditLogData {
  adminId?: string;
  action: string;
  method: string;
  path: string;
  targetType?: string;
  targetId?: string;
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

  async quarantineRoom(roomId: string, reason: string) {
    const [room] = await this.db
      .update(scheme.rooms)
      .set({ status: 'quarantined', quarantineReason: reason })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return room;
  }

  async unquarantineRoom(roomId: string) {
    const [room] = await this.db
      .update(scheme.rooms)
      .set({ status: 'active', quarantineReason: null, quarantinedUntil: null })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return room;
  }

  async updateModifiers(
    userId: string,
    modifiers: Partial<typeof scheme.users.$inferInsert>,
  ) {
    const [updatedUser] = await this.db
      .update(scheme.users)
      .set(modifiers)
      .where(eq(scheme.users.id, userId))
      .returning();
    return updatedUser;
  }

  async createWarning(userId: string, adminId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: scheme.users.id })
        .from(scheme.users)
        .where(eq(scheme.users.id, userId))
        .limit(1);
      if (!user) return null;

      const [warning] = await tx
        .insert(scheme.userWarnings)
        .values({ userId, adminId, reason })
        .returning();
      await tx
        .update(scheme.users)
        .set({ warnsCount: sql`${scheme.users.warnsCount} + 1` })
        .where(eq(scheme.users.id, userId));
      return warning;
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

      await tx
        .update(scheme.users)
        .set({ warnsCount: sql`greatest(${scheme.users.warnsCount} - 1, 0)` })
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
    return { items, total };
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

  async findMessages(options: AdminPageOptions) {
    const where = options.search
      ? ilike(scheme.messages.cipherText, `%${options.search}%`)
      : undefined;
    const [items, [{ total }]] = await Promise.all([
      this.db.query.messages.findMany({
        where,
        orderBy: [desc(scheme.messages.createdAt)],
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        with: {
          author: { columns: { id: true, username: true, isMogged: true } },
          room: { columns: { id: true, title: true } },
        },
      }),
      this.db.select({ total: count() }).from(scheme.messages).where(where),
    ]);
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
    const [entry] = await this.db
      .insert(scheme.adminAuditLogs)
      .values(data)
      .returning();
    return entry;
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
