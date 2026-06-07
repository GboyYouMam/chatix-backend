import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

@Injectable()
export class MessagesRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>
    ) {}

    async create(roomId: string, authorId: string, cipherText: string, ipAddress?: string) {
        const [newMessage] = await this.db.insert(scheme.messages).values({
            roomId,
            authorId,
            cipherText,
            ipAddress,
        }).returning();

        return newMessage;
    }

    async findByRoomId(roomId: string) {
        return this.db.query.messages.findMany({
            where: eq(scheme.messages.roomId, roomId),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
            with: {
                author: {
                    columns: {
                        id: true,
                        username: true,
                        pfp_url: true,
                    }
                }
            }
        });
    }
}