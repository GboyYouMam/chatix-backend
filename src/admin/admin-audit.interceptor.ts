import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, from, map, mergeMap, Observable, throwError } from 'rxjs';
import { RequestUser } from '../auth/dto/request-user.dto';
import { AdminActivityLogger } from './admin-activity-logger.service';
import { AUDIT_ACTION } from './audit-action.decorator';

type AdminRequest = Request & { user?: RequestUser };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function errorStatus(error: unknown): number {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return 500;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : 500;
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly activityLogger: AdminActivityLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const metadata = Reflect.getMetadata(AUDIT_ACTION, context.getHandler()) as
      | { key: string; targetType: string }
      | undefined;
    if (request.user?.role !== 'admin' || request.method === 'GET' || !metadata)
      return next.handle();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const action = metadata.key;
    const rawTargetId =
      request.params.id ?? request.params.userId ?? request.params.warningId;
    const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : rawTargetId;

    const writeLog = (success: boolean, statusCode: number, error?: unknown) =>
      this.activityLogger.record({
        adminId: request.user?.userId,
        action,
        actionKey: metadata.key,
        method: request.method,
        path: request.originalUrl,
        targetType: metadata.targetType,
        targetId,
        targetLabel: undefined,
        statusCode,
        success,
        durationMs: Date.now() - startedAt,
        details: {
          ...(typeof (request.body as { reason?: unknown })?.reason === 'string'
            ? { reason: (request.body as { reason: string }).reason }
            : {}),
          ...(error ? { error: errorMessage(error) } : {}),
        },
      });

    return next.handle().pipe(
      mergeMap((result: unknown) =>
        from(writeLog(true, response.statusCode)).pipe(map(() => result)),
      ),
      catchError((error: unknown) =>
        from(writeLog(false, errorStatus(error), error)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
