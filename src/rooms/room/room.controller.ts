import {Controller, Post, Get, Param, Body, UseGuards} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createRoom(
        @Body() body: any,
        @CurrentUser() user: any
    ) {
        return this.roomsService.createRoom(
            user.userId,
            body.title,
            body.topic,
            body.description
        );
    }

    @Get()
    async getAllActiveRooms() {
        return this.roomsService.getLobbyRooms();
    }

    @Get(':id')
    async getRoom(@Param('id') id: string) {
        return this.roomsService.getRoomsDetails(id);
    }
}
