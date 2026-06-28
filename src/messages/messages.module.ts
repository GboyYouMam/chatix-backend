import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';

@Module({
  controllers: [MessagesController],
  providers: [
      MessagesService,
    MessagesRepository,
    MessagesGateway,
  ],
  exports: [MessagesService, MessagesRepository]
})
export class MessagesModule {}