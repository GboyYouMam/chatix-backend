import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthUserValidator } from './auth-user.validator';
import { JwtPayload } from './jwt-payload';
import { socketUserData } from './socket-user';
import { wsAuthError } from './ws-auth-error';

type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);
  constructor(
    private readonly jwt: JwtService,
    private readonly validator: AuthUserValidator,
  ) {}
  async authenticate(client: Socket) {
    const token = (client.handshake.auth as Record<string, unknown> | undefined)
      ?.token;
    if (typeof token !== 'string' || !token) throw new UnauthorizedException();
    try {
      const user = await this.validator.validate(
        await this.jwt.verifyAsync<JwtPayload>(
          token.replace(/^Bearer\s+/i, ''),
        ),
      );
      socketUserData(client).user = user;
      return user;
    } catch (error) {
      this.logger.warn({ event: 'ws.auth_failed', socketId: client.id });
      throw error;
    }
  }

  /**
   * Socket.IO middleware: the connection is accepted only after the token is
   * verified, so no event can reach a handler before `client.data.user` is set.
   */
  middleware(options: { adminOnly?: boolean } = {}): SocketMiddleware {
    return (socket, next) => {
      this.authenticate(socket)
        .then((user) => {
          if (options.adminOnly && user.role !== 'admin') {
            next(
              Object.assign(new Error('admins only, chud'), {
                data: { message: 'admins only, chud' },
              }),
            );
            return;
          }
          next();
        })
        .catch((error: unknown) => {
          const data = wsAuthError(error);
          next(Object.assign(new Error(String(data.message)), { data }));
        });
    };
  }
}
