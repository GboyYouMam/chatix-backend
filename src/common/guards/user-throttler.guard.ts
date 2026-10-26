import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestUser } from '../../auth/dto/request-user.dto';

export const USER_SCOPED_THROTTLE = 'user-scoped-throttle';
export const UserScopedThrottle = () => SetMetadata(USER_SCOPED_THROTTLE, true);

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    ip: string;
    user?: RequestUser;
  }): Promise<string> {
    return Promise.resolve(req.user?.userId ?? req.ip);
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
