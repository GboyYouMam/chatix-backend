import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
import {RequestUser} from "./dto/create-message.dto";

@Injectable()
export class MessagesService {
    constructor(private readonly messagesRepository: MessagesRepository) {}

    async sendMessage(roomId: string, authorId: string, cipherText: string, ipAddress?: string) {
        return this.messagesRepository.create(roomId, authorId, cipherText, ipAddress);
    }

    async getRoomHistory(roomId: string) {
        return this.messagesRepository.getRoomHistory(roomId);
    }

    async deleteMessage(messageId: string, user: RequestUser) {
        if( user.role !== 'admin' )
            throw new ForbiddenException('Hell nah u`r not an admin tf are u doin');

        const deletedMessage = await this.messagesRepository.deleteMessage(messageId);

        if (!deletedMessage) throw new NotFoundException('Message not found');

        return { message: 'ELIMINATED BY KILLSQUAD', deletedMessage };
    }
}