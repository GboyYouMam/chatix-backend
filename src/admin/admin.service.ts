import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import * as scheme from '../database/scheme';

@Injectable()
export class AdminService {
    constructor(private readonly adminRepository: AdminRepository) {}

    async quarantineRoom(roomId: string, reason: string) {
        const room = await this.adminRepository.quarantineRoom(roomId, reason);

        if (!room) {
            throw new NotFoundException('Room not found lmao');
        }
        return { message: 'THIS ROOM GOT QUARANTINED BY KILLSQUAD', room };
    }

    async unquarantineRoom(roomId: string) {
        const room = await this.adminRepository.unquarantineRoom(roomId);

        if (!room) {
            throw new NotFoundException('Room not found lmao');
        }
        return { message: 'Room got blessed by us, pray to us, KILLSQUAD', room };
    }

    async updateModifiers(userId: string, modifiers: Partial<typeof scheme.users.$inferInsert>) {
        const user = await this.adminRepository.updateModifiers(userId, modifiers);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const { password, ...safeUser } = user;

        return {
            message: 'User modifiers updated. Total domination. KILLSQUAD',
            user: safeUser
        };
    }
}