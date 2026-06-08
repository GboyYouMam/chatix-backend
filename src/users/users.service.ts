import { Injectable, NotFoundException } from '@nestjs/common';
import {UpdateUserData, UsersRepository} from '../auth/users.repository';
import { StorageService } from '../storage/storage.service';
import {UpdateProfileDto} from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly storageService: StorageService
    ) {}

    async getUserProfile(userId: string) {
        const user = await this.usersRepository.findById(userId);

        if (!user) {
            throw new NotFoundException('Foid not found');
        }

        return user;
    }

    async updateProfile(userId: string, data: UpdateProfileDto, file?: Express.Multer.File) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatePayload: UpdateUserData = { ...data };

        if (file) {
            const fileData = await this.storageService.uploadFile(file, userId);
            updatePayload.pfp_url = fileData.url;
        }

        const updatedUser = await this.usersRepository.updateProfile(userId, updatePayload);

        if ('password' in updatedUser) {
            delete (updatedUser as any).password;
        }

        return updatedUser;
    }
}