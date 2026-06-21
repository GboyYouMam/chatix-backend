import {Controller, Post, Get, Param, Body, UseGuards, Ip, Delete} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {  RequestUser } from './dto/create-message.dto';
import { CreateMessageDTO } from "./dto/create-message.dto";
import {AdminGuard} from "../auth/admin.guard";

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) {}

    @Post()
    async createMessage(
        @Body() body: CreateMessageDTO,
        @CurrentUser() user: RequestUser,
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

    @UseGuards(AdminGuard)
    @Delete(':id')
    async deleteMessage(
        @Param('id') id: string,
        @CurrentUser() user: RequestUser
    ) {
        return this.messagesService.deleteMessage(id, user);
    }
}