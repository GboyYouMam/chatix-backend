import {Controller, Post, Get, Param, Body, UseGuards, Patch, Delete, Query} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { RequestUser } from './dto/create-room.dto';
import { CreateRoomDTO } from './dto/create-room.dto';
import { AdminGuard } from '../../auth/admin.guard';
import {UpdateRoomDTO} from "./dto/update-room.dto";

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createRoom(
        @Body() body: CreateRoomDTO,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.createRoom(user.userId, body);
    }

    @Get()
    async getAllActiveRooms(@Query('publicity') publicity?: 'public' | 'private') {
        if (publicity) {
            return this.roomsService.getRoomsByPublicity(publicity);
        }
        return this.roomsService.getLobbyRooms();
    }

    @Get(':id')
    async getRoom(@Param('id') id: string) {
        return this.roomsService.getRoomsDetails(id);
    }

    @Get('by-name/:name')
    async getRoomByName(@Param('name') name: string) {
        return this.roomsService.findRoomByName(name);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateRoom(
        @Param('id') id: string,
        @Body() body: UpdateRoomDTO,
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
        @CurrentUser() user: RequestUser
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

    @UseGuards(JwtAuthGuard)
    @Post(':id/join')
    async joinPrivateRoom(
        @Param('id') id: string,
        @Body('password') password: string,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.joinPrivateRoom(id, user.userId, password);
    }
}