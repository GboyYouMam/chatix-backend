import { Injectable, Inject } from '@nestjs/common';
import { DB_CONNECTION } from '../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as scheme from '../database/scheme';

@Injectable()
export class AdminRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>
    ) {}

    async quarantineRoom(roomId: string, reason: string) {
        const [room] = await this.db.update(scheme.rooms)
            .set({
                status: 'quarantined',
                quarantineReason: reason
            })
            .where(eq(scheme.rooms.id, roomId))
            .returning();
        return room;
    }

    async unquarantineRoom(roomId: string) {
        const [room] = await this.db.update(scheme.rooms)
            .set({
                status: 'active',
                quarantineReason: null
            })
            .where(eq(scheme.rooms.id, roomId))
            .returning();
        return room;
    }

    async updateModifiers(userId: string, modifiers: Partial<typeof scheme.users.$inferInsert>) {
        const [updatedUser] = await this.db.update(scheme.users)
            .set(modifiers)
            .where(eq(scheme.users.id, userId))
            .returning();
        return updatedUser;
    }
}