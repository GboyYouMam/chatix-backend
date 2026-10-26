import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { OptionalJwtGuard } from './optional-jwt.guard';

@Module({
  imports: [RealtimeModule],
  controllers: [AchievementsController],
  providers: [AchievementsService, OptionalJwtGuard],
  exports: [AchievementsService],
})
export class AchievementsModule {}
