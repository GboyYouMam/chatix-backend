import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import * as scheme from '../database/scheme';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Patch('rooms/:id/quarantine')
    async quarantineRoom(
        @Param('id') id: string,
        @Body('reason') reason: string
    ) {
        return this.adminService.quarantineRoom(id, reason);
    }

    @Patch('rooms/:id/unquarantine')
    async unquarantineRoom(@Param('id') id: string) {
        return this.adminService.unquarantineRoom(id);
    }

    @Patch('users/:id/modifiers')
    async updateUserModifiers(
        @Param('id') id: string,
        @Body() body: Partial<typeof scheme.users.$inferInsert>
    ) {
        return this.adminService.updateModifiers(id, body);
    }
}