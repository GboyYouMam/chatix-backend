import {Controller, Post, Get, Param, Body, UseGuards} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import {CreateRoomDto, type RequestUser} from "./dto/create-room.dto";

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createRoom(
        @Body() body: CreateRoomDto,
        @CurrentUser() user: RequestUser
    ) {
        return this.roomsService.createRoom({
            creatorId: user.userId,
            title: body.title,
            topic: body.topic,
            description: body.description
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
}
