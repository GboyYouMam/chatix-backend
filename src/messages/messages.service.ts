import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RequestUser } from '../auth/dto/request-user.dto';
import { RoomService } from '../rooms/room/room.service';
import { GetMessagesQueryDto } from './dto/get-messages.query.dto';
import { ConfigService } from '@nestjs/config';
import { ipTag } from '../common/net/ip-tag';
import { toPublicMessage } from './message.serializer';
import { AchievementsService } from '../achievements/achievements.service';
import {
  CosmeticsService,
  DEFAULT_PUBLIC_COSMETICS,
  toAuthorCosmetics,
} from '../shop/cosmetics.service';
import {
  isRenameCursed,
  ProfileEffectsService,
} from '../shop/profile-effects.service';

type MessageAttachmentInput = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};
import {
  assertAllowed,
  MESSAGE_ATTACHMENT_POLICY,
} from '../storage/file-policy';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly storageService: StorageService,
    private readonly realtime: RealtimeService,
    private readonly roomsService: RoomService,
    private readonly config: ConfigService,
    private readonly achievements: AchievementsService,
    private readonly cosmetics: CosmeticsService,
    private readonly profileEffects: ProfileEffectsService,
  ) {}

  async sendMessage(
    roomId: string,
    authorId: string,
    cipherText: string,
    ipAddress?: string,
    files: Express.Multer.File[] = [],
  ) {
    if (files.length > 5) {
      throw new BadRequestException('A message can contain at most 5 files');
    }

    if (!cipherText?.trim() && !files.length) {
      throw new BadRequestException(
        'Message text or an attachment is required',
      );
    }

    const user = await this.messagesRepository.getUserForValidation(authorId);
    if (!user) throw new NotFoundException('User not found');

    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      throw new ForbiddenException(
        `BANNED BY KILLSQUAD UNTIL ${user.bannedUntil.toISOString()}`,
      );
    }

    if (user.yapCooldown && new Date(user.yapCooldown) > new Date()) {
      throw new ForbiddenException(
        'Yap limit exceeded. Shut up lil` bro and wait lmao.',
      );
    }

    const room = await this.messagesRepository.getRoomForValidation(roomId);
    if (!room) throw new NotFoundException('Room not found');
    await this.roomsService.assertCanAccess(roomId, authorId);

    if (room.status === 'quarantined' || room.status === 'banned') {
      throw new ForbiddenException(
        `Room is locked: ${room.statusReason || 'KILLSQUAD DECIDED SO'}`,
      );
    }

    if (user.debt > 0) {
      throw new ForbiddenException(
        `u can't send a reply with ${user.debt} debt, bum.`,
      );
    }

    let finalMessageText = cipherText || '';

    if (user.adminGlazeMode) {
      const glazeQuotes = [
        'i fully support the decision of our magnificent killsquad administration! 🙏🙏🙏🙏',
        'god bless our admins, grant them good health. i love them, and i thank them. 🙏🙏🙏🙏🙏🙏',
        'i wanna give all my lifesavings to the killsquad administration. they deserve it! 🙏🙏🙏🙏🙏🙏',
      ];
      finalMessageText =
        glazeQuotes[Math.floor(Math.random() * glazeQuotes.length)];
    } else if (user.isClown) {
      finalMessageText = 'well ugh actually ' + finalMessageText + ' 🤓☝️🤡';
    }

    const uploadedUrls: string[] = [];
    try {
      const attachments: MessageAttachmentInput[] = [];
      for (const file of files) {
        const detected = await assertAllowed(file, MESSAGE_ATTACHMENT_POLICY);
        const stored = await this.storageService.upload(
          file,
          detected,
          'attachments',
        );
        uploadedUrls.push(stored.url);
        attachments.push({
          url: stored.url,
          fileName: file.originalname,
          mimeType: stored.mime,
          size: stored.size,
        });
      }
      const roomWasQuiet = await this.messagesRepository.wasRoomSilentFor(
        roomId,
        30 * 86400000,
      );
      const message = await this.messagesRepository.create(
        roomId,
        authorId,
        finalMessageText,
        ipAddress,
        attachments,
      );
      if (message) {
        try {
          await this.messagesRepository.incrementMessageCount(authorId);
          await this.achievements.evaluate(authorId, 'message');
          const grants: Promise<boolean>[] = [];
          if (roomWasQuiet)
            grants.push(this.achievements.grantSafely(authorId, 'necromancer'));
          if (user.timezone) {
            try {
              const hour = new Intl.DateTimeFormat('en', {
                timeZone: user.timezone,
                hour: '2-digit',
                hourCycle: 'h23',
              }).format(new Date());
              if (hour === '03')
                grants.push(
                  this.achievements.grantSafely(authorId, 'night_owl'),
                );
            } catch {
              // Invalid legacy time zones cannot block a message.
            }
          }
          await Promise.allSettled(grants);
        } catch (error) {
          this.logger.error({
            event: 'achievement.message_failed',
            authorId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (!message) return message;
      const authorCosmetics = toAuthorCosmetics(
        (await this.cosmetics.forUsers([authorId])).get(authorId) ??
          DEFAULT_PUBLIC_COSMETICS,
      );
      const renameCursed = isRenameCursed(
        (await this.profileEffects.forUsers([authorId])).get(authorId) ?? [],
      );
      return toPublicMessage(
        message,
        message.ipAddress
          ? ipTag(
              message.ipAddress,
              this.config.getOrThrow<string>('IP_TAG_SECRET'),
            )
          : null,
        authorCosmetics,
        renameCursed,
      );
    } catch (error) {
      await Promise.all(
        uploadedUrls.map(async (url) => {
          try {
            await this.storageService.removeUploadedFile(url);
          } catch (cleanupError) {
            this.logger.warn(
              `upload.cleanup_failed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`,
            );
          }
        }),
      );
      throw error;
    }
  }

  assertCanAccess(roomId: string, userId: string) {
    return this.roomsService.assertCanAccess(roomId, userId);
  }

  async getRoomHistory(
    roomId: string,
    userId: string,
    query: GetMessagesQueryDto,
  ) {
    await this.roomsService.assertCanAccess(roomId, userId);
    const history = await this.messagesRepository.getRoomHistory(roomId, query);
    // One cosmetics lookup per page, not per message.
    const authorIds = history.items.flatMap((message) =>
      message.author ? [message.author.id] : [],
    );
    const [cosmetics, effects] = await Promise.all([
      this.cosmetics.forUsers(authorIds),
      this.profileEffects.forUsers(authorIds),
    ]);
    return {
      ...history,
      items: history.items.map((message) =>
        toPublicMessage(
          message,
          message.ipAddress
            ? ipTag(
                message.ipAddress,
                this.config.getOrThrow<string>('IP_TAG_SECRET'),
              )
            : null,
          message.author
            ? toAuthorCosmetics(
                cosmetics.get(message.author.id) ?? DEFAULT_PUBLIC_COSMETICS,
              )
            : undefined,
          message.author
            ? isRenameCursed(effects.get(message.author.id) ?? [])
            : false,
        ),
      ),
    };
  }

  async deleteMessage(messageId: string, actor: RequestUser) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (actor.role !== 'admin') throw new ForbiddenException('Admins only');
    const deletedMessage =
      await this.messagesRepository.deleteMessage(messageId);

    if (!deletedMessage) throw new NotFoundException('Message not found');

    this.realtime.emitToRoom(deletedMessage.roomId, 'messageDeleted', {
      id: deletedMessage.id,
    });
    if (actor.role === 'admin')
      this.realtime.emitToAdmins('admin:message_deleted', {
        id: deletedMessage.id,
      });

    return { message: 'ELIMINATED BY KILLSQUAD', deletedMessage };
  }
}
