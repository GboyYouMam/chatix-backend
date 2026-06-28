import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import { RoomsRepository } from "./rooms.repository";
import { CreateRoomDTO } from "./dto/create-room.dto";

@Injectable()
export class RoomService {
    constructor(private readonly roomsRepository: RoomsRepository) {}

    async createRoom(creatorId: string, data: CreateRoomDTO) {
        const user = await this.roomsRepository.getUserValidationData(creatorId);
        if (!user) throw new NotFoundException('User not found');

        if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
            throw new ForbiddenException(`BANNED BY KILLSQUAD UNTIL ${user.bannedUntil.toISOString()}`);
        }
        if (user.debt > 0) {
            throw new ForbiddenException(`You are in debt (${user.debt} credits). Pay up, bum, no rooms for you.`);
        }

        return this.roomsRepository.create({
            ...data,
            creatorId
        });
    }

    async getLobbyRooms(){
        return this.roomsRepository.findLobbyRooms();
    }

    async getRoomsDetails(roomId: string) {
        const room = await this.roomsRepository.findById(roomId);
        if (!room) {
            throw new NotFoundException('Room not found lmao try again');
        }
        if (room.status === 'banned') {
            throw new ForbiddenException('This room is freakin banned for some reason by us, admins get a job instead');
        }
        return room;
    }

    async getRoomsByPublicity(publicity: 'public' | 'private') {
        return this.roomsRepository.findRoomsByPublicity(publicity);
    }

    async updateRoomPublicity(roomId: string, userId: string, newPublicity: 'public' | 'private') {
        const room = await this.getRoomsDetails(roomId);
        if (room.creatorId !== userId) {
            throw new ForbiddenException("Not your room, lil bro.");
        }
        return this.roomsRepository.updatePublicity(roomId, newPublicity);
    }

    async updateRoom(roomId: string, userId: string, data: Partial<CreateRoomDTO>) {
        const room = await this.getRoomsDetails(roomId);
        if (room.creatorId !== userId) {
            throw new ForbiddenException("Hell nah, u'r not the owner of this room tf are u doin");
        }
        return this.roomsRepository.updateRoom(roomId, data);
    }

    async deleteRoom(roomId: string, userId: string) {
        const room = await this.getRoomsDetails(roomId);
        if (room.creatorId !== userId) {
            throw new ForbiddenException("Lil` bro why are u tring to delete someone else room? get a life lmao");
        }
        return this.roomsRepository.deleteRoom(roomId);
    }

    async updateRoomStatus(roomId: string, newStatus: 'active' | 'checkout' | 'banned' | 'quarantined') {
        await this.getRoomsDetails(roomId);
        return this.roomsRepository.updateStatus(roomId, newStatus);
    }
}