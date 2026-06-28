import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomsController } from './room.controller';
import { RoomsRepository } from './rooms.repository';

@Module({
  controllers: [RoomsController],
  providers: [
    RoomService,
    RoomsRepository
  ],
  exports: [RoomService, RoomsRepository]
})
export class RoomsModule {}