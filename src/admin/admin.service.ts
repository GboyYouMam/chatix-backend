import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../auth/users.repository';
import * as scheme from '../database/scheme';
import { MessagesRepository } from '../messages/messages.repository';
import { AdminPageOptions, AdminRepository } from './admin.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly usersRepository: UsersRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  private page<T>(
    result: { items: T[]; total: number },
    options: AdminPageOptions,
  ) {
    return {
      items: result.items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / options.limit),
      },
    };
  }

  async quarantineRoom(roomId: string, reason: string) {
    const room = await this.adminRepository.quarantineRoom(roomId, reason);
    if (!room) throw new NotFoundException('Room not found');
    return { message: 'Room quarantined', room };
  }

  async unquarantineRoom(roomId: string) {
    const room = await this.adminRepository.unquarantineRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return { message: 'Room unquarantined', room };
  }

  async updateModifiers(
    userId: string,
    modifiers: Partial<typeof scheme.users.$inferInsert>,
  ) {
    const user = await this.adminRepository.updateModifiers(userId, modifiers);
    if (!user) throw new NotFoundException('User not found');
    const { password, ...safeUser } = user;
    void password;
    return { message: 'User modifiers updated', user: safeUser };
  }

  async addWarning(userId: string, adminId: string, reason: string) {
    const warning = await this.adminRepository.createWarning(
      userId,
      adminId,
      reason,
    );
    if (!warning) throw new NotFoundException('User not found');
    return { message: 'Warning added', warning };
  }

  async revokeWarning(userId: string, warningId: string) {
    const warning = await this.adminRepository.revokeWarning(userId, warningId);
    if (!warning) throw new NotFoundException('Active warning not found');
    return { message: 'Warning revoked', warning };
  }

  async vaporizeUser(userId: string) {
    const target = await this.usersRepository.findById(userId);
    if (!target) throw new NotFoundException('User not found');
    const user = await this.usersRepository.vaporizeUser(userId);
    if (!user) throw new NotFoundException('User not found');
    const { password, ...safeUser } = user;
    void password;
    return { message: 'User vaporized', user: safeUser };
  }

  async deleteMessage(messageId: string) {
    const message = await this.messagesRepository.deleteMessage(messageId);
    if (!message) throw new NotFoundException('Message not found');
    return { message: 'Message deleted', data: message };
  }

  async getUsers(options: AdminPageOptions) {
    return this.page(await this.adminRepository.findUsers(options), options);
  }

  async getRooms(options: AdminPageOptions) {
    return this.page(await this.adminRepository.findRooms(options), options);
  }

  async getMessages(options: AdminPageOptions) {
    return this.page(await this.adminRepository.findMessages(options), options);
  }

  async getWarnings(userId: string, options: AdminPageOptions) {
    return this.page(
      await this.adminRepository.findWarnings(userId, options),
      options,
    );
  }

  async getAuditLogs(options: AdminPageOptions) {
    return this.page(
      await this.adminRepository.findAuditLogs(options),
      options,
    );
  }
}
