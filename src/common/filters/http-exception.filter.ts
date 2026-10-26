import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const known = exception instanceof HttpException;
    const statusCode = known ? exception.getStatus() : 500;
    const response = known ? exception.getResponse() : null;
    const body =
      typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : {};
    const rawMessage =
      body.message ?? (typeof response === 'string' ? response : null);
    const message = !known
      ? 'internal error. not ur fault (probably)'
      : Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : (rawMessage ?? exception.message);
    const extraFields = { ...body };
    delete extraFields.statusCode;
    delete extraFields.message;
    delete extraFields.error;
    const fields = known ? extraFields : {};
    if (statusCode >= 500)
      this.logger.error(
        { err: exception, requestId: req.id },
        'http.exception',
      );
    else this.logger.warn({ statusCode, requestId: req.id }, 'http.exception');
    res
      .status(statusCode)
      .json({ statusCode, message, requestId: req.id, ...fields });
  }
}
