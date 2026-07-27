import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserData, UsersRepository } from '../auth/users.repository';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly storageService: StorageService,
  ) {}

  async getUserProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('Foid not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.canChangeProfile) {
      throw new ForbiddenException(
        'Admins says that u DONT HAVE ANY RIGHTS TO DO IT, go cry about it',
      );
    }

    const updatePayload: UpdateUserData = { ...data };

    if (file) {
      const fileData = await this.storageService.uploadFile(file, userId);
      updatePayload.pfp_url = fileData.url;
    }

    const updatedUser = await this.usersRepository.updateProfile(
      userId,
      updatePayload,
    );

    if ('password' in updatedUser) {
      delete (updatedUser as any).password;
    }

    return updatedUser;
  }

  async findByUsername(username: string) {
    const user = await this.usersRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundException('This user not found ughhhh');
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async auraFarming(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newAura = Number(user.aura) + 1;

    const updatedUser = await this.usersRepository.updateProfile(userId, {
      aura: newAura,
    } as any);

    return {
      aura: newAura,
      message: 'aura farmed',
    };
  }
}
