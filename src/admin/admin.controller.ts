import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminService } from './admin.service';
import { AdminPaginationDTO } from './dto/admin-pagination.dto';
import { CreateWarningDTO } from './dto/create-warning.dto';
import { QuarantineRoomDTO } from './dto/quarantine-room.dto';
import { UpdateUserModifiersDTO } from './dto/update-user-modifiers.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('rooms/:id/quarantine')
  quarantineRoom(@Param('id') id: string, @Body() body: QuarantineRoomDTO) {
    return this.adminService.quarantineRoom(id, body.reason);
  }

  @Patch('rooms/:id/unquarantine')
  unquarantineRoom(@Param('id') id: string) {
    return this.adminService.unquarantineRoom(id);
  }

  @Patch('users/:id/modifiers')
  updateUserModifiers(
    @Param('id') id: string,
    @Body() body: UpdateUserModifiersDTO,
  ) {
    const modifiersToApply: Record<string, unknown> = {
      ...body,
      bannedUntil: body.bannedUntil ? new Date(body.bannedUntil) : undefined,
      yapCooldown: body.yapCooldown ? new Date(body.yapCooldown) : undefined,
    };
    Object.keys(modifiersToApply).forEach((key) => {
      if (modifiersToApply[key] === undefined) delete modifiersToApply[key];
    });
    return this.adminService.updateModifiers(id, modifiersToApply);
  }

  @Post('users/:id/warnings')
  addWarning(
    @Param('id') id: string,
    @Body() body: CreateWarningDTO,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.adminService.addWarning(id, admin.userId, body.reason);
  }

  @Get('users/:id/warnings')
  getWarnings(@Param('id') id: string, @Query() query: AdminPaginationDTO) {
    return this.adminService.getWarnings(id, query);
  }

  @Delete('users/:userId/warnings/:warningId')
  revokeWarning(
    @Param('userId') userId: string,
    @Param('warningId') warningId: string,
  ) {
    return this.adminService.revokeWarning(userId, warningId);
  }

  @Delete('users/:id/vaporize')
  vaporizeUser(@Param('id') id: string) {
    return this.adminService.vaporizeUser(id);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string) {
    return this.adminService.deleteMessage(id);
  }

  @Get('users')
  getUsers(@Query() query: AdminPaginationDTO) {
    return this.adminService.getUsers(query);
  }

  @Get('rooms')
  getRooms(@Query() query: AdminPaginationDTO) {
    return this.adminService.getRooms(query);
  }

  @Get('messages')
  getMessages(@Query() query: AdminPaginationDTO) {
    return this.adminService.getMessages(query);
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AdminPaginationDTO) {
    return this.adminService.getAuditLogs(query);
  }
}
