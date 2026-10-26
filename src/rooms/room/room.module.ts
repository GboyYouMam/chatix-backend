import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomsController } from './room.controller';
import { RoomsRepository } from './rooms.repository';
import { AchievementsModule } from '../../achievements/achievements.module';

@Module({
  imports: [AchievementsModule],
  controllers: [RoomsController],
  providers: [RoomService, RoomsRepository],
  exports: [RoomService, RoomsRepository],
})
export class RoomsModule {}
