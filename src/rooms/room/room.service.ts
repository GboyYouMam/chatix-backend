import {
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateRoomDTO } from './dto/create-room.dto';
import { UpdateRoomPublicityDto } from './dto/update-room-publicity.dto';
import { toPublicRoom } from './room.serializer';
import { RoomsRepository } from './rooms.repository';
import { AdminAuditContext } from '../../admin/audit-context';

@Injectable()
export class RoomService {
  constructor(
    private readonly roomsRepository: RoomsRepository,
    private readonly realtime: RealtimeService,
    private readonly auditContext: AdminAuditContext,
  ) {}

  private isRoomNameConflict(error: unknown): boolean {
    const databaseError =
      typeof error === 'object' && error !== null && 'cause' in error
        ? error.cause
        : error;
    return (
      typeof databaseError === 'object' &&
      databaseError !== null &&
      'code' in databaseError &&
      databaseError.code === '23505' &&
      'constraint_name' in databaseError &&
      databaseError.constraint_name === 'rooms_title_lower_unique'
    );
  }

  async createRoom(creatorId: string, data: CreateRoomDTO) {
    const user = await this.roomsRepository.getUserValidationData(creatorId);
    if (!user) throw new NotFoundException('User not found');

    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      throw new ForbiddenException(
        `BANNED BY KILLSQUAD UNTIL ${user.bannedUntil.toISOString()}`,
      );
    }
    if (user.debt > 0) {
      throw new ForbiddenException(
        `you're in debt (${user.debt}). pay up, bum. no rooms for you.`,
      );
    }

    let room;
    try {
      room = await this.roomsRepository.create({
        ...data,
        password: data.password
          ? await bcrypt.hash(data.password, 10)
          : undefined,
        creatorId,
      });
    } catch (error) {
      if (this.isRoomNameConflict(error)) {
        throw new ConflictException({
          code: 'ROOM_NAME_TAKEN',
          message: 'this name is taken. be original, chud.',
        });
      }
      throw error;
    }
    return toPublicRoom(room);
  }

  async getLobbyRooms() {
    return (await this.roomsRepository.findLobbyRooms()).map((room) =>
      toPublicRoom(room),
    );
  }

  async getRoomsDetails(
    roomId: string,
    viewer?: { userId: string; role: string },
  ) {
    const room = await this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Room not found lmao try again');
    if (room.status === 'banned') {
      throw new ForbiddenException(
        'This room is freakin banned for some reason by us, admins get a job instead',
      );
    }
    return toPublicRoom(room, viewer);
  }

  async assertCanAccess(roomId: string, userId: string): Promise<void> {
    const room = await this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (
      room.publicity === 'private' &&
      room.creatorId !== userId &&
      !(await this.roomsRepository.checkAccess(roomId, userId))
    ) {
      throw new ForbiddenException('private room. know the password or leave.');
    }
  }

  async getRoomsByPublicity(publicity: 'public' | 'private') {
    return (await this.roomsRepository.findRoomsByPublicity(publicity)).map(
      (room) => toPublicRoom(room),
    );
  }

  async getMyRooms(userId: string) {
    return (await this.roomsRepository.findMine(userId)).map((room) =>
      toPublicRoom(room, { userId, role: 'user' }),
    );
  }

  async updateRoomPublicity(
    roomId: string,
    userId: string,
    data: UpdateRoomPublicityDto,
  ) {
    const room = await this.getRoomsDetails(roomId);
    if (room.creatorId !== userId)
      throw new ForbiddenException('Not your room, lil bro.');
    const password =
      data.publicity === 'private' && data.password
        ? await bcrypt.hash(data.password, 10)
        : null;
    return toPublicRoom(
      await this.roomsRepository.updatePublicity(
        roomId,
        data.publicity,
        password,
      ),
    );
  }

  async updateRoom(
    roomId: string,
    userId: string,
    data: Partial<CreateRoomDTO>,
  ) {
    const room = await this.getRoomsDetails(roomId);
    if (room.creatorId !== userId) {
      throw new ForbiddenException(
        "Hell nah, u'r not the owner of this room tf are u doin",
      );
    }
    const update = {
      ...data,
      ...(data.password && { password: await bcrypt.hash(data.password, 10) }),
    };
    try {
      return toPublicRoom(
        await this.roomsRepository.updateRoom(roomId, update),
      );
    } catch (error) {
      if (this.isRoomNameConflict(error)) {
        throw new ConflictException({
          code: 'ROOM_NAME_TAKEN',
          message: 'this name is taken. be original, chud.',
        });
      }
      throw error;
    }
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.getRoomsDetails(roomId);
    if (room.creatorId !== userId) {
      throw new ForbiddenException(
        'lil bro why are u trying to delete someone else room? get a life lmao',
      );
    }
    return this.roomsRepository.deleteRoom(roomId);
  }

  async updateRoomStatus(
    roomId: string,
    newStatus: 'active' | 'checkout' | 'banned' | 'quarantined',
  ) {
    const existing = await this.roomsRepository.findById(roomId);
    if (!existing) throw new NotFoundException('Room not found');
    const room = await this.roomsRepository.updateStatus(roomId, newStatus);
    if (room) {
      this.auditContext.setTarget(room.title, roomId);
      this.auditContext.setDiff(
        { status: existing.status, statusReason: existing.statusReason },
        { status: room.status, statusReason: room.statusReason },
      );
      const quarantined = newStatus === 'quarantined';
      this.realtime.emitToRoom(roomId, 'roomQuarantined', {
        roomId,
        quarantined,
      });
      this.realtime.emitToAdmins('admin:room_updated', {
        room: {
          ...toPublicRoom(room),
          messagesCount: await this.roomsRepository.countMessages(roomId),
        },
      });
    }
    return room ? toPublicRoom(room, { userId: '', role: 'admin' }) : room;
  }

  async joinPrivateRoom(roomId: string, userId: string, passwordInput: string) {
    const room = await this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Room dropped dead');
    if (room.publicity !== 'private') {
      throw new ForbiddenException(
        'Bro this room is public, just go in directly',
      );
    }

    const hasAccess = await this.roomsRepository.checkAccess(roomId, userId);
    if (hasAccess) return { success: true, message: 'Already inside' };
    if (!(await bcrypt.compare(passwordInput, room.password ?? ''))) {
      throw new ForbiddenException('Wrong password. Get lost lmao.');
    }

    await this.roomsRepository.grantAccess(roomId, userId);
    return {
      success: true,
      message:
        'ACCESS GRANTED. Welcome to the something PRIVATE... like an ISLAND of some close friends of US president.',
    };
  }

  async findRoomByName(
    roomName: string,
    viewer?: { userId: string; role: string },
  ) {
    const room = await this.roomsRepository.findRoomByName(roomName);
    if (!room) {
      throw new NotFoundException(
        `Room '${roomName}' not found lmao try again`,
      );
    }
    if (room.status === 'banned') {
      throw new ForbiddenException(
        'This room is freakin banned for some reason by us, admins get a job instead',
      );
    }
    return toPublicRoom(room, viewer);
  }
}
