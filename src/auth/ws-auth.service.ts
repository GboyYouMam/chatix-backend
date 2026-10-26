import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthUserValidator } from './auth-user.validator';
import { JwtPayload } from './jwt-payload';
import { socketUserData } from './socket-user';
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
}
