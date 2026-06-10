import {Controller, Post, Get, Param, Body, UseGuards, Patch, Delete} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { type RequestUser } from './dto/create-room.dto';
import { type CreateRoomDTO } from './dto/create-room.dto';
import { AdminGuard } from '../../auth/admin.guard';

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createRoom(
        @Body() body: CreateRoomDTO,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.createRoom(user.userId, {
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
        @Body() body: Partial<CreateRoomDTO>,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.updateRoom(id, user.userId, body);
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Patch(':id/status')
    async updateRoomStatus(
        @Param('id') id: string,
        @Body('status') status: 'active' | 'checkout' | 'banned' | 'quarantined'
    ) {
        return this.roomsService.updateRoomStatus(id, status);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/publicity')
    async updateRoomPublicity(
        @Param('id') id: string,
        @Body('publicity') publicity: 'public' | 'private',
        @CurrentUser() user: RequestUser // <-- Дістаємо юзера
    ) {
        return this.roomsService.updateRoomPublicity(id, user.userId, publicity);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async deleteRoom(
        @Param('id') id: string,
        @CurrentUser() user: RequestUser
    ) {
        await this.roomsService.deleteRoom(id, user.userId);
        return { message: 'ERASED' };
    }
}