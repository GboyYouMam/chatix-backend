import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {UpdateUserData, UsersRepository} from '../auth/users.repository';
import { StorageService } from '../storage/storage.service';
import {UpdateProfileDto} from "./dto/update-profile.dto";
import {ProfileFilesDTO} from "./dto/profile-files.dto";

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

        const respectCount = await this.usersRepository.countProfileRespects(user.id);

        return {
            ...user,
            respectCount,
            respect_count: respectCount,
        };
    }

    async updateProfile(userId: string, data: UpdateProfileDto, files?: ProfileFilesDTO) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatePayload: UpdateUserData = { ...data };

        if (files) {
            if (files.file && files.file.length > 0) {
                const fileData = await this.storageService.uploadFile(files.file[0], userId);
                updatePayload.pfp_url = fileData.url;
            }
            if (files.upper_banner && files.upper_banner.length > 0) {
                const fileData = await this.storageService.uploadFile(files.upper_banner[0], userId);
                updatePayload.upper_banner_url = fileData.url;
            }
            if (files.left_banner && files.left_banner.length > 0) {
                const fileData = await this.storageService.uploadFile(files.left_banner[0], userId);
                updatePayload.left_banner_url = fileData.url;
            }
            if (files.right_banner && files.right_banner.length > 0) {
                const fileData = await this.storageService.uploadFile(files.right_banner[0], userId);
                updatePayload.right_banner_url = fileData.url;
            }
        }

        const updatedUser = await this.usersRepository.updateProfile(userId, updatePayload);

        if ('password' in updatedUser) {
            delete (updatedUser as any).password;
        }

        return updatedUser;
    }

    async findByUsername(username: string, viewerId?: string) {
        const user = await this.usersRepository.findPublicByUsername(username);

        if (!user) {
            throw new NotFoundException('This user not found ughhhh');
        }

        const [comments, hasRespected, respectCount] = await Promise.all([
            this.usersRepository.findProfileComments(user.id),
            viewerId ? this.usersRepository.hasRespectedProfile(user.id, viewerId) : false,
            this.usersRepository.countProfileRespects(user.id),
        ]);

        return {
            ...user,
            respectCount,
            respect_count: respectCount,
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
        const profileUser = await this.usersRepository.findPublicByUsername(username);
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
            comment,
        };
    }

    async giveProfileRespect(username: string, admirerId: string) {
        const profileUser = await this.usersRepository.findPublicByUsername(username);
        if (!profileUser) {
            throw new NotFoundException('This user not found ughhhh');
        }

        if (profileUser.id === admirerId) {
            throw new BadRequestException('You cannot respect yourself on your own profile');
        }

        const respect = await this.usersRepository.giveProfileRespect(
            profileUser.id,
            admirerId,
        );

        return {
            message: respect.alreadyRespected ? 'Respect already given' : 'Respect given',
            respect_count: respect.respectCount,
            ...respect,
        };
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
            message: "aura farmed"
        };
    }

    async payDebt(userId: string) {
        const user = await this.usersRepository.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        if (user.debt <= 0) {
            return { message: 'You have no debt, bro. Chill.', debt: 0 };
        }

        const updated = await this.usersRepository.payDebt(userId);
        return {
            message: '-1 credit. Keep grinding, bum.',
            debt: updated?.debt
        };
    }
}
