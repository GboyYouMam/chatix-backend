import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DB_CONNECTION } from '../../database/database.module';
import * as scheme from '../../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {CreateRoomDTO} from "./dto/create-room.dto";

@Injectable()
export class RoomsRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>
    ) {}

    async getUserValidationData(userId: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.id, userId),
        });
    }

    async create(data: { creatorId: string; title: string; topic?: string; description?: string; publicity: 'public' | 'private'; }) {
        const [newRoom] = await this.db.insert(scheme.rooms).values({
            creatorId: data.creatorId,
            title: data.title,
            topic: data.topic,
            description: data.description,
            publicity: data.publicity,
        }).returning();

        return newRoom;
    }

    async findById(roomId: string) {
        return this.db.query.rooms.findFirst({
            where: eq(scheme.rooms.id, roomId),
            with: { creator: true },
        });
    }

    async findRoomsByStatus(status: 'active' | 'checkout' | 'banned') {
        return this.db.query.rooms.findMany({
            where: eq(scheme.rooms.status, status),
            orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
            with: {
                creator: {
                    columns: { id: true, username: true, pfp_url: true }
                }
            }
        });
    }

    async findRoomsByPublicity(publicity: 'public' | 'private') {
        return this.db.query.rooms.findMany({
            where: eq(scheme.rooms.publicity, publicity),
            orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
            with: {
                creator: {
                    columns: { id: true, username: true, pfp_url: true }
                }
            }
        });
    }

    async findLobbyRooms() {
        return this.db.query.rooms.findMany({
            where: and(
                eq(scheme.rooms.status, 'active'),
                eq(scheme.rooms.publicity, 'public')
            ),
            orderBy: (rooms, { desc }) => [desc(rooms.createdAt)],
            with: {
                creator: {
                    columns: { id: true, username: true, pfp_url: true }
                }
            }
        });
    }

    async updateStatus(roomId: string, newStatus: 'active' | 'checkout' | 'banned' | 'quarantined') {
        const [updatedRoom] = await this.db.update(scheme.rooms)
            .set({ status: newStatus })
            .where(eq(scheme.rooms.id, roomId))
            .returning();

        return updatedRoom;
    }

    async deleteRoom(roomId: string) {
        const [deletedRoom] = await this.db.delete(scheme.rooms)
            .where(eq(scheme.rooms.id, roomId))
            .returning();
        return deletedRoom;
    }

    async updatePublicity(roomId: string, newPublicity: 'public' | 'private') {
        const [updatedRoom] = await this.db.update(scheme.rooms)
            .set({ publicity: newPublicity })
            .where(eq(scheme.rooms.id, roomId))
            .returning();
        return updatedRoom;
    }

    async updateRoom(roomId: string, data: Partial<CreateRoomDTO>) {
        const [updatedRoom] = await this.db.update(scheme.rooms)
            .set({
                title: data.title,
                topic: data.topic,
                description: data.description,
                publicity: data.publicity
            })
            .where(eq(scheme.rooms.id, roomId))
            .returning();
        return updatedRoom;
    }
}