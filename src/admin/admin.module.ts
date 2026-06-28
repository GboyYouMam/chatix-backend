import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { DatabaseModule } from '../database/database.module';

import { UsersModule } from '../users/users.module';
import { RoomsModule } from '../rooms/room/room.module';
import { MessagesModule } from '../messages/messages.module';
import { AdminGateway } from './admin.gateway';
import { AdminActivityLogger } from './admin-activity-logger.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

@Module({
  imports: [DatabaseModule, UsersModule, RoomsModule, MessagesModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminRepository,
    AdminGateway,
    AdminActivityLogger,
    AdminAuditInterceptor,
  ],
})
export class AdminModule {}
