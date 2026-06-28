import {Injectable, Inject, ForbiddenException, NotFoundException} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RequestUser } from "./dto/create-message.dto";

@Injectable()
export class MessagesRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>
    ) {}

    async getUserForValidation(userId: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.id, userId),
        });
    }

    async getRoomForValidation(roomId: string) {
        return this.db.query.rooms.findFirst({
            where: eq(scheme.rooms.id, roomId),
        });
    }
    async create(roomId: string, authorId: string, cipherText: string, ipAddress?: string) {
        const [newMessage] = await this.db.insert(scheme.messages).values({
            roomId,
            authorId,
            cipherText,
            ipAddress,
        }).returning();

        return this.db.query.messages.findFirst({
            where: eq(scheme.messages.id, newMessage.id),
            with: {
                author: {
                    columns: {
                        id: true,
                        username: true,
                        pfp_url: true,
                        forcedTitle: true,
                    }
                }
            }
        });
    }

    async getRoomHistory(roomId: string) {
        return this.db.query.messages.findMany({
            where: eq(scheme.messages.roomId, roomId),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
            with: {
                author: {
                    columns: {
                        id: true,
                        username: true,
                        pfp_url: true,
                        forcedTitle: true,
                        isMogged: true,
                    }
                }
            }
        });
    }

    async findById(id: string) {
        return this.db.query.messages.findFirst({
            where: eq(scheme.messages.id, id),
        });
    }

    async deleteMessage(messageId: string) {
        const [deletedMessage] = await this.db.update(scheme.messages)
            .set({cipherText: 'GOT DELETED LMAO CRY ABOUT IT'})
            .where(eq(scheme.messages.id, messageId))
            .returning();

        return deletedMessage;
    }

    async findAllAdmin() {
        return this.db.query.messages.findMany({
            orderBy: (messages, { desc }) => [desc(messages.createdAt)],
            limit: 100,
            with: {
                author: { columns: { id: true, username: true, isMogged: true } }
            }
        });
    }
}