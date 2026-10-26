import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserData, UsersRepository } from './users.repository';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileFilesDTO } from './dto/profile-files.dto';
import { assertAllowed, PROFILE_IMAGE_POLICY } from '../storage/file-policy';
import { AchievementsService } from '../achievements/achievements.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly storageService: StorageService,
    private readonly achievements: AchievementsService,
  ) {}

  async getUserProfile(userId: string, timezone?: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('no such chud. touch grass and try again.');
    }

    const respectCount = user.respectCount;

    await this.recordLogin(userId, timezone);
    const achievements = await this.usersRepository.findAchievements(userId);
    return {
      ...user,
      achievements: achievements.map(({ key, unlockedAt }) => ({
        key,
        unlockedAt,
      })),
      featuredAchievements: user.featuredAchievements,
      fightTitle:
        user.fightTitleUntil && user.fightTitleUntil > new Date()
          ? user.fightTitle
          : null,
      respectCount,
      respect_count: respectCount,
    };
  }

  private isTimezone(value: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  async recordLogin(userId: string, timezone?: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) return;
    await this.achievements.evaluate(userId, 'login');
    await this.usersRepository.updateLogin(
      userId,
      timezone && this.isTimezone(timezone)
        ? timezone
        : (user.timezone ?? undefined),
    );
    if (user.bannedUntil && user.bannedUntil <= new Date()) {
      await this.achievements.grant(userId, 'survivor');
    }
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
    files?: ProfileFilesDTO,
  ) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.canChangeProfile) {
      throw new ForbiddenException('ur profile is frozen by the admins. cope.');
    }

    const updatePayload: UpdateUserData = {
      ...(data.username !== undefined && { username: data.username }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.vibe !== undefined && { vibe: data.vibe }),
    };

    if (files) {
      if (files.file && files.file.length > 0) {
        const detected = await assertAllowed(
          files.file[0],
          PROFILE_IMAGE_POLICY,
        );
        updatePayload.pfp_url = await this.storageService.upload(
          files.file[0],
          detected,
          'profiles',
        );
      }
      if (files.upper_banner && files.upper_banner.length > 0) {
        const detected = await assertAllowed(
          files.upper_banner[0],
          PROFILE_IMAGE_POLICY,
        );
        updatePayload.upper_banner_url = await this.storageService.upload(
          files.upper_banner[0],
          detected,
          'profiles',
        );
      }
      if (files.left_banner && files.left_banner.length > 0) {
        const detected = await assertAllowed(
          files.left_banner[0],
          PROFILE_IMAGE_POLICY,
        );
        updatePayload.left_banner_url = await this.storageService.upload(
          files.left_banner[0],
          detected,
          'profiles',
        );
      }
      if (files.right_banner && files.right_banner.length > 0) {
        const detected = await assertAllowed(
          files.right_banner[0],
          PROFILE_IMAGE_POLICY,
        );
        updatePayload.right_banner_url = await this.storageService.upload(
          files.right_banner[0],
          detected,
          'profiles',
        );
      }
    }

    const updatedUser = await this.usersRepository.updateProfile(
      userId,
      updatePayload,
    );

    return updatedUser;
  }

  async findByUsername(username: string, viewerId?: string) {
    const user = await this.usersRepository.findPublicByUsername(username);

    if (!user) {
      throw new NotFoundException('This user not found ughhhh');
    }

    const [comments, hasRespected, activeWarnings] = await Promise.all([
      this.usersRepository.findProfileComments(user.id),
      viewerId
        ? this.usersRepository.hasRespectedProfile(user.id, viewerId)
        : false,
      this.usersRepository.findActiveWarnings(user.id),
    ]);

    return {
      ...user,
      activeWarnings: activeWarnings.map(({ reason, createdAt }) => ({
        reason,
        createdAt: createdAt.toISOString(),
      })),
      comments,
      hasRespected,
    };
  }

  async getProfileComments(username: string) {
    const user = await this.usersRepository.findPublicByUsername(username);
    if (!user) {
      throw new NotFoundException('This user not found ughhhh');
    }

    return this.usersRepository.findProfileComments(user.id);
  }

  async createProfileComment(username: string, authorId: string, body: string) {
    const profileUser =
      await this.usersRepository.findPublicByUsername(username);
    if (!profileUser) {
      throw new NotFoundException('This user not found ughhhh');
    }

    const cleanBody = body.trim();
    if (!cleanBody) {
      throw new BadRequestException('Comment cannot be empty');
    }

    const comment = await this.usersRepository.createProfileComment(
      profileUser.id,
      authorId,
      cleanBody,
    );

    return {
      message: 'Comment added',
      comment_id: comment.id,
    };
  }

  async giveProfileRespect(username: string, admirerId: string) {
    const profileUser =
      await this.usersRepository.findPublicByUsername(username);
    if (!profileUser) {
      throw new NotFoundException('This user not found ughhhh');
    }

    if (profileUser.id === admirerId) {
      throw new BadRequestException(
        'You cannot respect yourself on your own profile',
      );
    }

    const respect = await this.usersRepository.giveProfileRespect(
      profileUser.id,
      admirerId,
    );
    return {
      message: respect.alreadyRespected
        ? 'Respect already given'
        : 'Respect given',
      ...respect,
    };
  }

  async auraFarming(userId: string) {
    const newAura = await this.usersRepository.incrementAura(userId);
    if (newAura === undefined) throw new NotFoundException('User not found');
    await this.achievements.evaluate(userId, 'aura');

    return {
      aura: newAura,
      message: 'aura farmed',
    };
  }

  async payDebt(userId: string) {
    const updated = await this.usersRepository.payDebt(userId);
    if (!updated) throw new NotFoundException('User not found');
    if (!updated.paid)
      return { message: 'You have no debt, bro. Chill.', debt: 0 };
    return {
      message: '-1 credit. Keep grinding, bum.',
      debt: updated?.debt,
    };
  }
}
