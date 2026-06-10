import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomsRepository } from "./rooms.repository";
import {CreateRoomDTO} from "./dto/create-room.dto";

@Injectable()
export class RoomService {
    constructor(private readonly roomsRepository: RoomsRepository) {}

    async createRoom(data: CreateRoomDTO) {
        return this.roomsRepository.create(data);
    }

    async getLobbyRooms(){
        return this.roomsRepository.findRoomsByStatus('active');
    }

    async getRoomsDetails(roomId: string) {
        const room = await this.roomsRepository.findById(roomId);
        if (!room) {
            throw new NotFoundException('Room not found lmao try again');
        }
        return room;
    }

    async getRoomsByPublicity(publicity: 'public' | 'private') {
        return this.roomsRepository.findRoomsByPublicity(publicity);
    }

    async updateRoomStatus(roomId: string, newStatus: 'active' | 'checkout' | 'banned') {
        await this.getRoomsDetails(roomId);
        return this.roomsRepository.updateStatus(roomId, newStatus);
    }

    async updateRoomPublicity(roomId: string, newPublicity: 'public' | 'private') {
        await this.getRoomsDetails(roomId);
        return this.roomsRepository.updatePublicity(roomId, newPublicity);
    }

    async updateRoom(roomId: string, data: Partial<CreateRoomDTO>) {
        await this.getRoomsDetails(roomId);
        return this.roomsRepository.updateRoom(roomId, data);
    }

    async deleteRoom(roomId: string) {
        await this.getRoomsDetails(roomId);
        return this.roomsRepository.deleteRoom(roomId);
    }
}