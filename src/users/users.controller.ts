import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Param,
  UploadedFiles,
  Patch,
  Headers,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateProfileCommentDto } from './dto/create-profile-comment.dto';
import { ProfileCommentsQueryDto } from './dto/profile-comments-query.dto';
import { PROFILE_IMAGE_POLICY } from '../storage/file-policy';
import { SkipThrottle } from '@nestjs/throttler';
import { AchievementsService } from '../achievements/achievements.service';
import { FeaturedAchievementsDto } from '../achievements/achievements.controller';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly achievements: AchievementsService,
  ) {}

  @Get('me')
  async getProfile(
    @CurrentUser() user: RequestUser,
    @Headers('x-timezone') timezone?: string,
  ) {
    return this.usersService.getUserProfile(user.userId, timezone);
  }

  @Post('me/age-confirmation')
  async confirmAge(@CurrentUser() user: RequestUser) {
    return this.usersService.confirmAge(user.userId);
  }

  @Patch('me/featured-achievements')
  async setFeaturedAchievements(
    @CurrentUser() user: RequestUser,
    @Body() body: FeaturedAchievementsDto,
  ) {
    return this.achievements.setFeatured(user.userId, body.keys ?? []);
  }

  @Get('profile/:username')
  async getUserByUsername(
    @Param('username') username: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.findByUsername(username, user.userId);
  }

  @Get('profile/:username/comments')
  async getProfileComments(
    @Param('username') username: string,
    @Query() query: ProfileCommentsQueryDto,
  ) {
    return this.usersService.getProfileComments(username, query);
  }

  @Post('profile/:username/comments')
  async createProfileComment(
    @Param('username') username: string,
    @Body() body: CreateProfileCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.createProfileComment(
      username,
      user.userId,
      body.body,
    );
  }

  @Post('profile/:username/respect')
  async giveProfileRespect(
    @Param('username') username: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.giveProfileRespect(username, user.userId);
  }

  @Post('update')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: PROFILE_IMAGE_POLICY.maxFiles },
        { name: 'upper_banner', maxCount: PROFILE_IMAGE_POLICY.maxFiles },
        { name: 'left_banner', maxCount: PROFILE_IMAGE_POLICY.maxFiles },
        { name: 'right_banner', maxCount: PROFILE_IMAGE_POLICY.maxFiles },
      ],
      { limits: { fileSize: PROFILE_IMAGE_POLICY.maxBytes } },
    ),
  )
  async updateProfile(
    @Body() body: UpdateProfileDto,
    @CurrentUser() user: RequestUser,
    @UploadedFiles()
    files?: {
      file?: Express.Multer.File[];
      upper_banner?: Express.Multer.File[];
      left_banner?: Express.Multer.File[];
      right_banner?: Express.Multer.File[];
    },
  ) {
    const updatedUser = await this.usersService.updateProfile(
      user.userId,
      body,
      files,
    );

    return {
      message: 'Chud successfully ascended and changed profile visuals',
      user: updatedUser,
    };
  }

  @Post('farm-aura')
  @SkipThrottle()
  async farmAura(@CurrentUser() user: RequestUser) {
    return this.usersService.auraFarming(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pay-debt')
  async payDebt(@CurrentUser() user: RequestUser) {
    return this.usersService.payDebt(user.userId);
  }
}
