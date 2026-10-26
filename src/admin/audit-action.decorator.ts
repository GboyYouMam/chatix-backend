import { SetMetadata } from '@nestjs/common';

export type AuditActionKey =
  | 'user.ban'
  | 'user.unban'
  | 'user.warn'
  | 'user.warn_revoke'
  | 'user.modifiers'
  | 'user.vaporize'
  | 'room.approve'
  | 'room.reject'
  | 'room.quarantine'
  | 'room.unquarantine'
  | 'room.status'
  | 'message.delete';

export const AUDIT_ACTION = 'admin:audit-action';
export const AuditAction = (
  key: AuditActionKey,
  targetType: 'user' | 'room' | 'message',
) => SetMetadata(AUDIT_ACTION, { key, targetType });
