import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/room/room.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { ShopModule } from '../shop/shop.module';

@Module({
  imports: [
    StorageModule,
    AuthModule,
    RoomsModule,
    AchievementsModule,
    ShopModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessagesGateway],
  exports: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
