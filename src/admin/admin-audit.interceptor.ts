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
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const action = `${request.method} ${request.path}`;
    const rawTargetId =
      request.params.id ?? request.params.userId ?? request.params.warningId;
    const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : rawTargetId;
    const pathSegments = request.path.split('/').filter(Boolean);
    const adminSegment = pathSegments.indexOf('admin');
    const targetType = pathSegments[adminSegment >= 0 ? adminSegment + 1 : 0];

    const requestBody: unknown = request.body;
    const bodyFields =
      typeof requestBody === 'object' && requestBody !== null
        ? Object.keys(requestBody)
        : [];

    const writeLog = (success: boolean, statusCode: number, error?: unknown) =>
      this.activityLogger.record({
        adminId: request.user?.userId,
        action,
        method: request.method,
        path: request.originalUrl,
        targetType,
        targetId,
        statusCode,
        success,
        durationMs: Date.now() - startedAt,
        details: {
          params: request.params,
          query: request.query,
          bodyFields,
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
