import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionsFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<{
      id?: string;
      data?: { user?: { userId?: string } };
      emit: (event: string, payload: unknown) => void;
    }>();
    const raw =
      exception instanceof WsException
        ? exception.getError()
        : 'internal error';
    const payload =
      typeof raw === 'string'
        ? { message: raw }
        : (raw as Record<string, unknown>);
    this.logger.warn(
      { socketId: client.id, userId: client.data?.user?.userId },
      'ws.exception',
    );
    client.emit('exception', {
      message: payload.message,
      ...(payload.code ? { code: payload.code } : {}),
    });
  }
}
