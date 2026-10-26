import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardService } from './leaderboard.service';
import { StimulusService } from './stimulus.service';

@Controller('economy')
export class EconomyController {
  constructor(
    private readonly stimulus: StimulusService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('stimulus')
  claimStimulus(@CurrentUser() user: RequestUser) {
    return this.stimulus.claim(user.userId);
  }

  @Get('leaderboard')
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboard.get(query.week ?? 'current');
  }
}
