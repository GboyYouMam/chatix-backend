import { Controller, Post, Get, Param, Body, UseGuards, Ip } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) {}

    @Post()
    async createMessage(
        @Body() body: { roomId: string; cipherText: string },
        @CurrentUser() user: any,
        @Ip() ip: string
    ) {
        return this.messagesService.sendMessage(
            body.roomId,
            user.userId,
            body.cipherText,
            ip
        );
    }

    @Get(':roomId')
    async getHistory(@Param('roomId') roomId: string) {
        return this.messagesService.getRoomHistory(roomId);
    }
}