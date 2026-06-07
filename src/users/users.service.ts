import { Injectable, NotFoundException } from '@nestjs/common';
import {UpdateUserData, UsersRepository} from '../auth/users.repository';

@Injectable()
export class UsersService {
    constructor(private readonly usersRepository: UsersRepository) {}

    async getUserProfile(userId: string) {
        const user = await this.usersRepository.findById(userId);

        if (!user) {
            throw new NotFoundException('Foid not found');
        }

        return user;
    }

    async updateProfile(userId: string, data: UpdateUserData) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('Користувача не знайдено');
        }

        return this.usersRepository.updateProfile(userId, data);
    }
}