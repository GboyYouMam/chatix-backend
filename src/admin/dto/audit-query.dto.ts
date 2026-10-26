import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AdminPaginationDTO } from './admin-pagination.dto';

export class AuditQueryDTO extends AdminPaginationDTO {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @IsOptional()
  @IsIn([
    'user.ban',
    'user.unban',
    'user.warn',
    'user.warn_revoke',
    'user.modifiers',
    'user.vaporize',
    'room.approve',
    'room.reject',
    'room.quarantine',
    'room.unquarantine',
    'room.status',
    'message.delete',
    'legacy',
  ])
  actionKey?: string;

  @IsOptional()
  @IsIn(['user', 'room', 'message'])
  targetType?: string;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
