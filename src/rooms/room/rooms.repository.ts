import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from '../../database/database.module';
import * as scheme from '../../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

@Injectable()
export class RoomsRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>
    ) {}

    async create(creatorId: string, title: string, topic?: string, description?: string) {
        const [newRoom] = await this.db.insert(scheme.rooms).values({
            creatorId,
            title,
            topic,
            description,
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

    async updateStatus(roomId: string, newStatus: 'active' | 'checkout' | 'banned') {
        const [updatedRoom] = await this.db.update(scheme.rooms)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(scheme.rooms.id, roomId))
            .returning();

        return updatedRoom;
    }
}