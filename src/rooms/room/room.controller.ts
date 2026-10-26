import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
  Delete,
  Query,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { RequestUser } from '../../auth/dto/request-user.dto';
import { CreateRoomDTO } from './dto/create-room.dto';
import { AdminGuard } from '../../auth/admin.guard';
import { UpdateRoomDTO } from './dto/update-room.dto';
import { AdminAuditInterceptor } from '../../admin/admin-audit.interceptor';
import { Throttle } from '@nestjs/throttler';
import { UpdateRoomPublicityDto } from './dto/update-room-publicity.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { ListRoomsQueryDto } from './dto/list-rooms.query.dto';
import { AuditAction } from '../../admin/audit-action.decorator';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    _error: unknown,
    user: TUser | undefined,
  ): TUser | undefined {
    return user;
  }
}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createRoom(
    @Body() body: CreateRoomDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.roomsService.createRoom(user.userId, body);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllActiveRooms(
    @Query() query: ListRoomsQueryDto,
    @CurrentUser() user?: RequestUser,
  ) {
    if (query.publicity) {
      if (query.publicity === 'private' && !user) {
        throw new UnauthorizedException('Authentication required');
      }
      return this.roomsService.getRoomsByPublicity(query.publicity);
    }
    return this.roomsService.getLobbyRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMyRooms(@CurrentUser() user: RequestUser) {
    return this.roomsService.getMyRooms(user.userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.roomsService.getRoomsDetails(id, user);
  }

  @Get('by-name/:name')
  @UseGuards(OptionalJwtAuthGuard)
  async getRoomByName(
    @Param('name') name: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.roomsService.findRoomByName(name, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoomDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.roomsService.updateRoom(id, user.userId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  @Patch(':id/status')
  @AuditAction('room.status', 'room')
  async updateRoomStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateRoomStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publicity')
  async updateRoomPublicity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoomPublicityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.roomsService.updateRoomPublicity(id, user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.roomsService.deleteRoom(id, user.userId);
    return { message: 'ERASED' };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async joinPrivateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('password') password: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.roomsService.joinPrivateRoom(id, user.userId, password);
  }
}
