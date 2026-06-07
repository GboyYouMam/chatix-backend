import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';

@Module({
  controllers: [MessagesController],
  providers: [
      MessagesService,
    MessagesRepository
  ],
  exports: [MessagesService],
})
export class MessagesModule {}