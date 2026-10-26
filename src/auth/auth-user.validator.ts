import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { BannedException } from '../common/errors/banned.exception';
import { RequestUser } from './dto/request-user.dto';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthUserValidator {
  constructor(private readonly users: UsersRepository) {}
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.users.findAuthState(payload.sub);
    if (!user || (payload.tv ?? 0) !== user.tokenVersion)
      throw new UnauthorizedException();
    if (user.bannedUntil && user.bannedUntil > new Date())
      throw new BannedException(user.bannedUntil, user.banReason);
    return { userId: user.id, username: user.username, role: user.role };
  }
}
