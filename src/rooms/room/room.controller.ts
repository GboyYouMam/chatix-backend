import {Controller, Post, Get, Param, Body, UseGuards, Patch, Delete} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { type RequestUser } from './dto/create-room.dto';
import { type CreateRoomDTO } from './dto/create-room.dto';

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createRoom(
        @Body() body: CreateRoomDTO,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.createRoom({
            creatorId: user.userId,
            title: body.title,
            topic: body.topic,
            description: body.description,
            publicity: body.publicity || 'public'
        });
    }
    @Get()
    async getAllActiveRooms() {
        return this.roomsService.getLobbyRooms();
    }

    @Get(':id')
    async getRoom(@Param('id') id: string) {
        return this.roomsService.getRoomsDetails(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateRoom(
        @Param('id') id: string,
        @Body() body: Partial<CreateRoomDTO>
    ) {
        return this.roomsService.updateRoom(id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/status')
    async updateRoomStatus(
        @Param('id') id: string,
        @Body('status') status: 'active' | 'checkout' | 'banned'
    ) {
        return this.roomsService.updateRoomStatus(id, status);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/publicity')
    async updateRoomPublicity(
        @Param('id') id: string,
        @Body('publicity') publicity: 'public' | 'private'
    ) {
        return this.roomsService.updateRoomPublicity(id, publicity);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async deleteRoom(@Param('id') id: string) {
        await this.roomsService.deleteRoom(id);
        return { message: 'Nah u erase it from existence' };
    }
}