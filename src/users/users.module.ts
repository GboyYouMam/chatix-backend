import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { StorageModule } from '../storage/storage.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [StorageModule, AchievementsModule],
  controllers: [UsersController],
  exports: [UsersService, UsersRepository],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
