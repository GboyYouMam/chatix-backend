import { Module } from '@nestjs/common';
import { EconomyController } from './economy.controller';
import { LeaderboardService } from './leaderboard.service';
import { StimulusService } from './stimulus.service';

@Module({
  controllers: [EconomyController],
  providers: [StimulusService, LeaderboardService],
})
export class EconomyModule {}
