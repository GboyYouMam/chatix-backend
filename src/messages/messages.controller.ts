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
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { CreateMessageDTO } from './dto/create-message.dto';
import { MessagesGateway } from './messages.gateway';
import { AdminAuditInterceptor } from '../admin/admin-audit.interceptor';
import { MESSAGE_ATTACHMENT_POLICY } from '../storage/file-policy';
import { Throttle } from '@nestjs/throttler';
import {
  UserScopedThrottle,
  UserThrottlerGuard,
} from '../common/guards/user-throttler.guard';
import { GetMessagesQueryDto } from './dto/get-messages.query.dto';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Post()
  @UserScopedThrottle()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
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
  async getHistory(
    @Param('roomId') roomId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.getRoomHistory(roomId, user.userId, query);
  }

  @UseInterceptors(AdminAuditInterceptor)
  @Delete(':id')
  async deleteMessage(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.deleteMessage(id, user);
  }
}
