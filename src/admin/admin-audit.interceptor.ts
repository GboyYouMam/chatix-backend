import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  catchError,
  defer,
  from,
  map,
  mergeMap,
  Observable,
  throwError,
} from 'rxjs';
import { RequestUser } from '../auth/dto/request-user.dto';
import { AdminActivityLogger } from './admin-activity-logger.service';
import { AUDIT_ACTION } from './audit-action.decorator';
import { AdminAuditContext } from './audit-context';

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
  constructor(
    private readonly activityLogger: AdminActivityLogger,
    private readonly auditContext: AdminAuditContext,
  ) {}

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

    const audit = {
      actionKey:
        metadata.key as import('./audit-action.decorator').AuditActionKey,
      targetType: metadata.targetType as 'user' | 'room' | 'message',
      targetId,
      details:
        typeof (request.body as { reason?: unknown })?.reason === 'string'
          ? { reason: (request.body as { reason: string }).reason }
          : {},
    };
    const writeLog = (
      success: boolean,
      statusCode: number,
      error?: unknown,
      result?: unknown,
    ) => {
      const context = this.auditContext.get();
      const value =
        typeof result === 'object' && result !== null
          ? (result as {
              username?: unknown;
              room?: { title?: unknown };
              user?: { username?: unknown };
              data?: { cipherText?: unknown };
            })
          : undefined;
      const resultLabel =
        value?.username ??
        value?.room?.title ??
        value?.user?.username ??
        value?.data?.cipherText;
      return this.activityLogger.record({
        adminId: request.user?.userId,
        action,
        actionKey: context?.actionKey ?? audit.actionKey,
        method: request.method,
        path: request.originalUrl,
        targetType: context?.targetType ?? audit.targetType,
        targetId: context?.targetId ?? targetId,
        targetLabel:
          context?.targetLabel ??
          (typeof resultLabel === 'string'
            ? resultLabel.slice(0, 255)
            : undefined),
        statusCode,
        success,
        durationMs: Date.now() - startedAt,
        details: {
          ...(context?.details ?? audit.details),
          ...(error ? { error: errorMessage(error) } : {}),
        },
      });
    };

    return defer(() => this.auditContext.run(audit, () => next.handle())).pipe(
      mergeMap((result: unknown) =>
        from(writeLog(true, response.statusCode, undefined, result)).pipe(
          map(() => result),
        ),
      ),
      catchError((error: unknown) =>
        from(writeLog(false, errorStatus(error), error)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
