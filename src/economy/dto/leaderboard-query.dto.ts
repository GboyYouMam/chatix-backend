import { IsIn, IsOptional } from 'class-validator';
import type { LeaderboardWeek } from '../leaderboard.service';

export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(['current', 'previous'])
  week?: LeaderboardWeek;
}
