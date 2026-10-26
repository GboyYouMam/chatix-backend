import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { AchievementsService } from './achievements.service';
import { OptionalJwtGuard } from './optional-jwt.guard';

class DiscoverAchievementDto {
  @IsString()
  key: string;
}

export class FeaturedAchievementsDto {
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get('catalog')
  @UseGuards(OptionalJwtGuard)
  async catalog(@Req() request: Request & { user?: RequestUser }) {
    return this.achievements.listCatalog(request.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('discover')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async discover(
    @CurrentUser() user: RequestUser,
    @Body() body: DiscoverAchievementDto,
  ) {
    return this.achievements.discover(user.userId, body.key);
  }
}
