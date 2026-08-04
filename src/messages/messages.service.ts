import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
import { RequestUser } from './dto/create-message.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly storageService: StorageService,
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
      throw new BadRequestException('Message text or an attachment is required');
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

    if (room.status === 'quarantined' || room.status === 'banned') {
      throw new ForbiddenException(
        `Room is locked: ${room.quarantineReason || 'KILLSQUAD DECIDED SO'}`,
      );
    }

    if (user.debt > 0) {
      throw new ForbiddenException(
        `U CANT SEND A REPLY WITH A DEBT ${user.debt}$ BUM`,
      );
    }

    let finalMessageText = cipherText || '';

    if (user.adminGlazeMode) {
      const glazeQuotes = [
        'I fully support the decision of our magnificent KILLSQUAD administration! 🙏🙏🙏🙏',
        'God bless our admins, God grant them good health. I love them, and I thank them.🙏🙏🙏🙏🙏🙏',
        'I wanna give all my lifesavings to the KILLSQUAD administration, they deserve it!🙏🙏🙏🙏🙏🙏',
      ];
      finalMessageText =
        glazeQuotes[Math.floor(Math.random() * glazeQuotes.length)];
    } else if (user.isClown) {
      finalMessageText = 'Well ugh actually ' + finalMessageText + ' 🤓☝️🤡';
    }

    const attachments = await Promise.all(
      files.map(async (file) => {
        const uploadedFile = await this.storageService.uploadFile(file, authorId);
        return {
          url: uploadedFile.url,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        };
      }),
    );

    return this.messagesRepository.create(
      roomId,
      authorId,
      finalMessageText,
      ipAddress,
      attachments,
    );
  }

  async getRoomHistory(roomId: string) {
    return this.messagesRepository.getRoomHistory(roomId);
  }

  async deleteMessage(messageId: string, user: RequestUser) {
    const deletedMessage =
      await this.messagesRepository.deleteMessage(messageId);

    if (!deletedMessage) throw new NotFoundException('Message not found');

    return { message: 'ELIMINATED BY KILLSQUAD', deletedMessage };
  }
}
