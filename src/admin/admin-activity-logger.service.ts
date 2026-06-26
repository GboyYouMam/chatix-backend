import { Injectable, Logger } from '@nestjs/common';
import { AdminGateway } from './admin.gateway';
import { AdminRepository, CreateAuditLogData } from './admin.repository';

@Injectable()
export class AdminActivityLogger {
  private readonly logger = new Logger(AdminActivityLogger.name);

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly adminGateway: AdminGateway,
  ) {}

  async record(data: CreateAuditLogData) {
    try {
      const entry = await this.adminRepository.createAuditLog(data);
      const level = data.success ? 'log' : 'warn';
      this.logger[level](
        `${data.action} ${data.statusCode} admin=${data.adminId ?? 'unknown'} target=${data.targetId ?? '-'}`,
      );
      this.adminGateway.sendLogToAdmins(entry);
      return entry;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to persist admin audit event: ${message}`);
      return null;
    }
  }
}
