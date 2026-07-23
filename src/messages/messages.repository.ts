import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RequestUser } from './dto/create-message.dto';

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
    const [newMessage] = await this.db
      .insert(scheme.messages)
      .values({
        roomId,
        authorId,
        cipherText,
        ipAddress,
      })
      .returning();

    if (attachments.length) {
      await this.db.insert(scheme.messageAttachments).values(
        attachments.map((attachment) => ({
          ...attachment,
          messageId: newMessage.id,
        })),
      );
    }

    return this.db.query.messages.findFirst({
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
          },
        },
        attachments: true,
      },
    });
  }

  async findById(id: string) {
    return this.db.query.messages.findFirst({
      where: eq(scheme.messages.id, id),
    });
  }

  async deleteMessage(messageId: string) {
    await this.db
      .delete(scheme.messageAttachments)
      .where(eq(scheme.messageAttachments.messageId, messageId));

    const [deletedMessage] = await this.db
      .update(scheme.messages)
      .set({
        cipherText: 'GOT DELETED LMAO CRY ABOUT IT',
        //cry bout that gif url
        attachmentUrl: 'https://c.tenor.com/XMRnHdhvVvcAAAAd/tenor.gif',
      })
      .where(eq(scheme.messages.id, messageId))
      .returning();

    return deletedMessage;
  }

  async findAllAdmin() {
    return this.db.query.messages.findMany({
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      limit: 100,
      with: {
        author: { columns: { id: true, username: true, isMogged: true } },
      },
    });
  }
}
