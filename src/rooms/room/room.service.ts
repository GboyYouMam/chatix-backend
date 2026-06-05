import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomsRepository } from "./rooms.repository";

@Injectable()
export class RoomService {
    constructor(private readonly roomsRepository: RoomsRepository) {}

    async createRoom(data: { creatorId: string; title: string; topic?: string; description?: string }) {
        return this.roomsRepository.create(data);
    }

    async getLobbyRooms(){
        return this.roomsRepository.findRoomsByStatus('active');
    }

    async getRoomsDetails(roomId){
        const room = await this.roomsRepository.findById(roomId);
        if(!room) {
            throw new NotFoundException('Room not found');
        }
        return room;
    }
}