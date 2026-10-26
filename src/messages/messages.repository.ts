import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { GetMessagesQueryDto } from './dto/get-messages.query.dto';
import { DbOrTx } from '../database/database.types';

type MessageAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

@Injectable()
export class MessagesRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof scheme>,
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
  async create(
    roomId: string,
    authorId: string,
    cipherText: string,
    ipAddress?: string,
    attachments: MessageAttachment[] = [],
  ) {
    return this.db.transaction(async (tx) =>
      this.createWith(tx, roomId, authorId, cipherText, ipAddress, attachments),
    );
  }

  private async createWith(
    db: DbOrTx,
    roomId: string,
    authorId: string,
    cipherText: string,
    ipAddress: string | undefined,
    attachments: MessageAttachment[],
  ) {
    const [newMessage] = await db
      .insert(scheme.messages)
      .values({ roomId, authorId, cipherText, ipAddress })
      .returning();
    if (attachments.length) {
      await db.insert(scheme.messageAttachments).values(
        attachments.map((attachment) => ({
          ...attachment,
          messageId: newMessage.id,
        })),
      );
    }
    return db.query.messages.findFirst({
      where: eq(scheme.messages.id, newMessage.id),
      with: {
        author: {
          columns: {
            id: true,
            username: true,
            pfp_url: true,
            forcedTitle: true,
          },
        },
        attachments: true,
      },
    });
  }

  async getRoomHistory(roomId: string, query: GetMessagesQueryDto) {
    const cursor = query.before
      ? await this.db.query.messages.findFirst({
          where: and(
            eq(scheme.messages.id, query.before),
            eq(scheme.messages.roomId, roomId),
          ),
          columns: { id: true, createdAt: true },
        })
      : undefined;
    if (query.before && !cursor) return { items: [], nextCursor: null };
    const rows = await this.db.query.messages.findMany({
      where: and(
        eq(scheme.messages.roomId, roomId),
        ...(cursor
          ? [
              or(
                lt(scheme.messages.createdAt, cursor.createdAt),
                and(
                  eq(scheme.messages.createdAt, cursor.createdAt),
                  lt(scheme.messages.id, cursor.id),
                ),
              ),
            ]
          : []),
      ),
      orderBy: [desc(scheme.messages.createdAt), desc(scheme.messages.id)],
      limit: query.limit + 1,
      with: {
        author: {
          columns: {
            id: true,
            username: true,
            pfp_url: true,
            forcedTitle: true,
            isMogged: true,
          },
        },
        attachments: true,
      },
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit).reverse();
    return {
      items: page,
      nextCursor: hasMore ? (page[0]?.id ?? null) : null,
    };
  }

  async findById(id: string) {
    return this.db.query.messages.findFirst({
      where: eq(scheme.messages.id, id),
    });
  }

  async deleteMessage(messageId: string) {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(scheme.messageAttachments)
        .where(eq(scheme.messageAttachments.messageId, messageId));
      const [deletedMessage] = await tx
        .update(scheme.messages)
        .set({
          cipherText: 'GOT DELETED LMAO CRY ABOUT IT',
          attachmentUrl: 'https://c.tenor.com/XMRnHdhvVvcAAAAd/tenor.gif',
          isDeleted: true,
        })
        .where(eq(scheme.messages.id, messageId))
        .returning();
      return deletedMessage;
    });
  }

  async findAllAdmin() {
    return this.db.query.messages.findMany({
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      limit: 100,
      with: {
        author: { columns: { id: true, username: true, isMogged: true } },
        room: { columns: { id: true, title: true } },
      },
    });
  }
}
