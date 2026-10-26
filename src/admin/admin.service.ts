import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { MessagesRepository } from '../messages/messages.repository';
import { AdminPageOptions, AdminRepository } from './admin.repository';
import { toAdminRoom, toAdminUser } from './admin.serializer';
import { RealtimeService } from '../realtime/realtime.service';
import { UpdateUserModifiersDTO } from './dto/update-user-modifiers.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly usersRepository: UsersRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly realtime: RealtimeService,
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
    const adminRoom = toAdminRoom(
      room,
      await this.adminRepository.countRoomMessages(roomId),
    );
    this.realtime.emitToRoom(roomId, 'roomQuarantined', {
      roomId,
      quarantined: true,
    });
    this.realtime.emitToAdmins('admin:room_updated', { room: adminRoom });
    return { message: 'Room quarantined', room: adminRoom };
  }

  async unquarantineRoom(roomId: string) {
    const room = await this.adminRepository.unquarantineRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    const adminRoom = toAdminRoom(
      room,
      await this.adminRepository.countRoomMessages(roomId),
    );
    this.realtime.emitToRoom(roomId, 'roomQuarantined', {
      roomId,
      quarantined: false,
    });
    this.realtime.emitToAdmins('admin:room_updated', { room: adminRoom });
    return { message: 'Room unquarantined', room: adminRoom };
  }

  async updateModifiers(
    adminId: string,
    userId: string,
    dto: UpdateUserModifiersDTO,
  ) {
    const { bannedUntil, yapCooldown, auraDelta, debtDelta, ...fields } = dto;
    const modifiers: Parameters<AdminRepository['updateModifiers']>[1] = {
      ...fields,
      auraDelta,
      debtDelta,
      ...(bannedUntil !== undefined
        ? { bannedUntil: bannedUntil ? new Date(bannedUntil) : null }
        : {}),
      ...(yapCooldown !== undefined
        ? { yapCooldown: yapCooldown ? new Date(yapCooldown) : null }
        : {}),
    };
    if (bannedUntil === null) {
      modifiers.banReason = null;
      modifiers.autoBannedAt = null;
    }
    const changed = Object.keys(dto).length > 0;
    if (!changed) {
      const current = await this.adminRepository.findUser(userId);
      if (!current) throw new NotFoundException('User not found');
      const warnings = await this.adminRepository.countActiveWarnings([userId]);
      return toAdminUser(current, warnings.get(userId) ?? 0);
    }
    const user = await this.adminRepository.updateModifiers(userId, modifiers);
    if (!user) throw new NotFoundException('User not found');
    const warnings = await this.adminRepository.countActiveWarnings([userId]);
    const safeUser = toAdminUser(user, warnings.get(userId) ?? 0);
    this.realtime.emitToAdmins('admin:user_updated', { user: safeUser });
    this.realtime.emitToUser(userId, 'user:updated', { userId });
    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      this.realtime.emitToUser(userId, 'user:banned', {
        bannedUntil: safeUser.bannedUntil,
        banReason: safeUser.banReason,
      });
      this.realtime.disconnectUser(userId);
    }
    void adminId;
    return safeUser;
  }

  async createWarning(userId: string, adminId: string, reason: string) {
    const result = await this.adminRepository.createWarning(
      userId,
      adminId,
      reason,
    );
    if (!result) throw new NotFoundException('User not found');
    const { warning, user, autoBanned } = result;
    const warnings = await this.adminRepository.countActiveWarnings([userId]);
    const safeUser = toAdminUser(user, warnings.get(userId) ?? 0);
    if (autoBanned) {
      this.logger.warn(
        JSON.stringify({ event: 'user.autobanned', adminId, userId }),
      );
      this.realtime.emitToUser(userId, 'user:banned', {
        bannedUntil: safeUser.bannedUntil,
        banReason: safeUser.banReason,
      });
      this.realtime.disconnectUser(userId);
    }
    this.realtime.emitToAdmins('admin:user_updated', { user: safeUser });
    this.realtime.emitToUser(userId, 'user:updated', { userId });
    return { warning, user: safeUser, autoBanned };
  }

  async revokeWarning(userId: string, warningId: string) {
    const warning = await this.adminRepository.revokeWarning(userId, warningId);
    if (!warning) throw new NotFoundException('Active warning not found');
    const user = await this.adminRepository.findUser(userId);
    if (user) {
      const warnings = await this.adminRepository.countActiveWarnings([userId]);
      this.realtime.emitToAdmins('admin:user_updated', {
        user: toAdminUser(user, warnings.get(userId) ?? 0),
      });
    }
    return { message: 'Warning revoked', warning };
  }

  async vaporizeUser(userId: string) {
    const user = await this.usersRepository.vaporizeUser(userId);
    if (!user) throw new NotFoundException('User not found');
    const warnings = await this.adminRepository.countActiveWarnings([userId]);
    const safeUser = toAdminUser(user, warnings.get(userId) ?? 0);
    this.realtime.emitToUser(userId, 'user:banned', {
      bannedUntil: null,
      banReason: 'vaporized',
    });
    this.realtime.disconnectUser(userId);
    this.realtime.emitToAdmins('admin:user_updated', {
      user: null,
      id: userId,
    });
    return { message: 'User vaporized', user: safeUser };
  }

  async deleteMessage(messageId: string) {
    const message = await this.messagesRepository.deleteMessage(messageId);
    if (!message) throw new NotFoundException('Message not found');
    this.realtime.emitToRoom(message.roomId, 'messageDeleted', {
      id: message.id,
    });
    this.realtime.emitToAdmins('admin:message_deleted', { id: message.id });
    return { message: 'Message deleted', data: message };
  }

  async getUsers(options: AdminPageOptions) {
    const result = await this.adminRepository.findUsers(options);
    return this.page(
      {
        ...result,
        items: result.items.map((user) =>
          toAdminUser(user, user.activeWarningsCount),
        ),
      },
      options,
    );
  }

  async getUser(userId: string) {
    const user = await this.adminRepository.findUser(userId);
    if (!user) throw new NotFoundException('no such chud');
    const warnings = await this.adminRepository.countActiveWarnings([userId]);
    return toAdminUser(user, warnings.get(userId) ?? 0);
  }

  async getRooms(options: AdminPageOptions) {
    const result = await this.adminRepository.findRooms(options);
    return this.page(
      {
        ...result,
        items: await Promise.all(
          result.items.map(async (room) =>
            toAdminRoom(
              room,
              await this.adminRepository.countRoomMessages(room.id),
            ),
          ),
        ),
      },
      options,
    );
  }

  async getRoom(roomId: string) {
    const room = await this.adminRepository.findRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return toAdminRoom(
      room,
      await this.adminRepository.countRoomMessages(roomId),
    );
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
