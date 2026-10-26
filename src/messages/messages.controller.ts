import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Ip,
  Delete,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { CreateMessageDTO } from './dto/create-message.dto';
import { AdminGuard } from '../auth/admin.guard';
import { MessagesGateway } from './messages.gateway';
import { MESSAGE_ATTACHMENT_POLICY } from '../storage/file-policy';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('attachments', MESSAGE_ATTACHMENT_POLICY.maxFiles, {
      limits: { fileSize: MESSAGE_ATTACHMENT_POLICY.maxBytes },
    }),
  )
  async createMessage(
    @Body() body: CreateMessageDTO,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const message = await this.messagesService.sendMessage(
      body.roomId,
      user.userId,
      body.cipherText,
      ip,
      files,
    );
    this.messagesGateway.broadcastMessage(body.roomId, message);
    return message;
  }

  @Get(':roomId')
  async getHistory(@Param('roomId') roomId: string) {
    return this.messagesService.getRoomHistory(roomId);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async deleteMessage(@Param('id') id: string) {
    return this.messagesService.deleteMessage(id);
  }
}
