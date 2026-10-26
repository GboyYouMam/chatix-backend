import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, count, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../../database/database.module';
import * as scheme from '../../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CreateRoomDTO } from './dto/create-room.dto';

export const CREATOR_COLUMNS = {
  id: true,
  username: true,
  pfp_url: true,
  forcedTitle: true,
} as const;

// Relations every public room payload needs for sponsor and spotlight display.
export const ROOM_WITH = {
  creator: { columns: CREATOR_COLUMNS },
  sponsor: { columns: { username: true } },
  spotlightMessage: {
    columns: { id: true, cipherText: true, createdAt: true, isDeleted: true },
    with: {
      author: { columns: { id: true, username: true, pfp_url: true } },
    },
  },
} as const;

@Injectable()
export class RoomsRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof scheme>,
  ) {}

  async getUserValidationData(userId: string) {
    return this.db.query.users.findFirst({
      where: eq(scheme.users.id, userId),
    });
  }

  async create(data: {
    creatorId: string;
    title: string;
    topic?: string;
    description?: string;
    publicity: 'public' | 'private';
    password?: string;
    theme?: string;
  }) {
    const [newRoom] = await this.db
      .insert(scheme.rooms)
      .values({
        creatorId: data.creatorId,
        title: data.title,
        topic: data.topic,
        description: data.description,
        publicity: data.publicity,
        password: data.password,
        theme: data.theme,
      })
      .returning();

    if (data.publicity === 'private') {
      await this.grantAccess(newRoom.id, data.creatorId);
    }

    return newRoom;
  }

  async findById(roomId: string) {
    return this.db.query.rooms.findFirst({
      where: eq(scheme.rooms.id, roomId),
      with: ROOM_WITH,
    });
  }

  // Re-reads a room with its relations after an update.
  private async reload(roomId: string) {
    const room = await this.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async findRoomByName(roomName: string) {
    return this.db.query.rooms.findFirst({
      where: sql`lower(${scheme.rooms.title}) = lower(${roomName})`,
      with: ROOM_WITH,
    });
  }

  async findRoomsByStatus(status: 'active' | 'checkout' | 'banned') {
    return this.db.query.rooms.findMany({
      where: eq(scheme.rooms.status, status),
      orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
      with: ROOM_WITH,
    });
  }

  async findMine(creatorId: string) {
    return this.db.query.rooms.findMany({
      where: eq(scheme.rooms.creatorId, creatorId),
      orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
      with: ROOM_WITH,
    });
  }

  async findRoomsByPublicity(publicity: 'public' | 'private') {
    return this.db.query.rooms.findMany({
      where: and(
        eq(scheme.rooms.status, 'active'),
        eq(scheme.rooms.publicity, publicity),
      ),
      orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
      with: ROOM_WITH,
    });
  }

  async findLobbyRooms() {
    return this.db.query.rooms.findMany({
      where: and(
        eq(scheme.rooms.status, 'active'),
        eq(scheme.rooms.publicity, 'public'),
      ),
      orderBy: (rooms, { desc }) => [
        sql`coalesce(${rooms.boostedUntil} > now(), false) desc`,
        desc(rooms.createdAt),
      ],
      with: ROOM_WITH,
    });
  }

  async updateStatus(
    roomId: string,
    newStatus: 'active' | 'checkout' | 'banned' | 'quarantined',
  ) {
    await this.db
      .update(scheme.rooms)
      .set({ status: newStatus })
      .where(eq(scheme.rooms.id, roomId))
      .returning();

    return this.reload(roomId);
  }

  async countMessages(roomId: string) {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scheme.messages)
      .where(eq(scheme.messages.roomId, roomId));
    return total;
  }

  async deleteRoom(roomId: string) {
    const [deletedRoom] = await this.db
      .delete(scheme.rooms)
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return deletedRoom;
  }

  async updatePublicity(
    roomId: string,
    newPublicity: 'public' | 'private',
    password: string | null,
  ) {
    await this.db
      .update(scheme.rooms)
      .set({ publicity: newPublicity, password })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return this.reload(roomId);
  }

  async updateRoom(roomId: string, data: Partial<CreateRoomDTO>) {
    await this.db
      .update(scheme.rooms)
      .set({
        title: data.title,
        topic: data.topic,
        description: data.description,
        publicity: data.publicity,
        password: data.publicity === 'public' ? null : data.password,
        theme: data.theme,
      })
      .where(eq(scheme.rooms.id, roomId))
      .returning();
    return this.reload(roomId);
  }

  async ownsItem(userId: string, itemKey: string) {
    const row = await this.db.query.userInventory.findFirst({
      where: and(
        eq(scheme.userInventory.userId, userId),
        eq(scheme.userInventory.itemKey, itemKey),
      ),
      columns: { itemKey: true },
    });
    return Boolean(row);
  }

  async hasAchievement(userId: string, key: string) {
    const row = await this.db.query.userAchievements.findFirst({
      where: and(
        eq(scheme.userAchievements.userId, userId),
        eq(scheme.userAchievements.key, key),
      ),
      columns: { key: true },
    });
    return Boolean(row);
  }

  async checkAccess(roomId: string, userId: string) {
    return this.db.query.roomAccesses.findFirst({
      where: and(
        eq(scheme.roomAccesses.roomId, roomId),
        eq(scheme.roomAccesses.userId, userId),
      ),
    });
  }

  async grantAccess(roomId: string, userId: string) {
    await this.db
      .insert(scheme.roomAccesses)
      .values({
        roomId,
        userId,
      })
      .onConflictDoNothing();
    return true;
  }
  async findAllAdmin() {
    return this.db.query.rooms.findMany({
      orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
      with: {
        creator: { columns: { id: true, username: true } },
      },
    });
  }
}
