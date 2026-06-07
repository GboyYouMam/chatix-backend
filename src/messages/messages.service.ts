import { Injectable } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
    constructor(private readonly messagesRepository: MessagesRepository) {}

    async sendMessage(roomId: string, authorId: string, cipherText: string, ipAddress?: string) {
        return this.messagesRepository.create(roomId, authorId, cipherText, ipAddress);
    }

    async getRoomHistory(roomId: string) {
        return this.messagesRepository.findByRoomId(roomId);
    }
}