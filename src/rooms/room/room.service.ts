import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateRoomDTO } from './dto/create-room.dto';
import { UpdateRoomPublicityDto } from './dto/update-room-publicity.dto';
import { toPublicRoom } from './room.serializer';
import { RoomsRepository } from './rooms.repository';

@Injectable()
export class RoomService {
  constructor(
    private readonly roomsRepository: RoomsRepository,
    private readonly realtime: RealtimeService,
  ) {}

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
        `You are in debt (${user.debt} credits). Pay up, bum, no rooms for you.`,
      );
    }

    const room = await this.roomsRepository.create({
      ...data,
      password: data.password
        ? await bcrypt.hash(data.password, 10)
        : undefined,
      creatorId,
    });
    return toPublicRoom(room);
  }

  async getLobbyRooms() {
    return (await this.roomsRepository.findLobbyRooms()).map(toPublicRoom);
  }

  async getRoomsDetails(roomId: string) {
    const room = await this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Room not found lmao try again');
    if (room.status === 'banned') {
      throw new ForbiddenException(
        'This room is freakin banned for some reason by us, admins get a job instead',
      );
    }
    return toPublicRoom(room);
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
      toPublicRoom,
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
    return toPublicRoom(await this.roomsRepository.updateRoom(roomId, update));
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.getRoomsDetails(roomId);
    if (room.creatorId !== userId) {
      throw new ForbiddenException(
        'Lil` bro why are u tring to delete someone else room? get a life lmao',
      );
    }
    return this.roomsRepository.deleteRoom(roomId);
  }

  async updateRoomStatus(
    roomId: string,
    newStatus: 'active' | 'checkout' | 'banned' | 'quarantined',
  ) {
    await this.getRoomsDetails(roomId);
    const room = await this.roomsRepository.updateStatus(roomId, newStatus);
    if (room) {
      const quarantined = newStatus === 'quarantined';
      this.realtime.emitToRoom(roomId, 'roomQuarantined', {
        roomId,
        quarantined,
      });
      this.realtime.emitToAdmins('admin:room_updated', {
        room: {
          ...toPublicRoom(room),
          quarantinedUntil: room.quarantinedUntil?.toISOString() ?? null,
          messagesCount: await this.roomsRepository.countMessages(roomId),
        },
      });
    }
    return room ? toPublicRoom(room) : room;
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

  async findRoomByName(roomName: string) {
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
    return toPublicRoom(room);
  }
}
