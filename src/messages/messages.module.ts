import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessagesGateway],
  exports: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
