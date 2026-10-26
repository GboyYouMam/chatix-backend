import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestUser } from '../../auth/dto/request-user.dto';
import { getClientIp } from '../net/client-ip';
import type { Request } from 'express';

export const USER_SCOPED_THROTTLE = 'user-scoped-throttle';
export const UserScopedThrottle = () => SetMetadata(USER_SCOPED_THROTTLE, true);

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request & { user?: RequestUser }): Promise<string> {
    return Promise.resolve(
      req.user?.userId ??
        getClientIp(req, {
          trustProxy: process.env.TRUST_PROXY,
          trustedIpHeader: process.env.TRUSTED_IP_HEADER,
        }),
    );
  }
}

@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    const userScoped = this.reflector.getAllAndOverride<boolean>(
      USER_SCOPED_THROTTLE,
      [context.getHandler(), context.getClass()],
    );
    if (userScoped) {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}
