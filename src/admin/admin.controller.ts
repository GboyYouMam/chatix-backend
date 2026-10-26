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
  ParseUUIDPipe,
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
import { AuditAction } from './audit-action.decorator';
import { AuditQueryDTO } from './dto/audit-query.dto';
import { RejectRoomDTO } from './dto/reject-room.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Patch('rooms/:id/approve')
  @AuditAction('room.approve', 'room')
  approveRoom(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.approveRoom(id);
  }

  @Patch('rooms/:id/reject')
  @AuditAction('room.reject', 'room')
  rejectRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectRoomDTO,
  ) {
    return this.adminService.rejectRoom(id, body.reason);
  }

  @Patch('rooms/:id/quarantine')
  @AuditAction('room.quarantine', 'room')
  quarantineRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QuarantineRoomDTO,
  ) {
    return this.adminService.quarantineRoom(id, body.reason);
  }

  @Patch('rooms/:id/unquarantine')
  @AuditAction('room.unquarantine', 'room')
  unquarantineRoom(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.unquarantineRoom(id);
  }

  @Patch('users/:id/modifiers')
  @AuditAction('user.modifiers', 'user')
  updateUserModifiers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserModifiersDTO,
  ) {
    return this.adminService.updateModifiers(id, body);
  }

  @Post('users/:id/warnings')
  @AuditAction('user.warn', 'user')
  addWarning(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateWarningDTO,
    @CurrentUser() admin: RequestUser,
  ) {
    return this.adminService.createWarning(id, admin.userId, body.reason);
  }

  @Get('users/:id/warnings')
  getWarnings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AdminPaginationDTO,
  ) {
    return this.adminService.getWarnings(id, query);
  }

  @Delete('users/:userId/warnings/:warningId')
  @AuditAction('user.warn_revoke', 'user')
  revokeWarning(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('warningId', ParseUUIDPipe) warningId: string,
  ) {
    return this.adminService.revokeWarning(userId, warningId);
  }

  @Delete('users/:id/vaporize')
  @AuditAction('user.vaporize', 'user')
  vaporizeUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.vaporizeUser(id);
  }

  @Delete('messages/:id')
  @AuditAction('message.delete', 'message')
  deleteMessage(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteMessage(id);
  }

  @Get('users')
  getUsers(@Query() query: AdminPaginationDTO) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Get('users/:id/ips')
  getUserIps(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserIps(id);
  }

  @Get('users/:id/messages')
  getUserMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AdminPaginationDTO,
  ) {
    return this.adminService.getUserMessages(id, query);
  }

  @Get('rooms')
  getRooms(@Query() query: AdminPaginationDTO) {
    return this.adminService.getRooms(query);
  }

  @Get('rooms/:id')
  getRoom(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getRoom(id);
  }

  @Get('messages')
  getMessages(@Query() query: AdminPaginationDTO) {
    return this.adminService.getMessages(query);
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AuditQueryDTO) {
    return this.adminService.getAuditLogs(query);
  }
}
