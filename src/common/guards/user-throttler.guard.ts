import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestUser } from '../../auth/dto/request-user.dto';

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
    if (
      context.getClass().name === 'MessagesController' &&
      context.getHandler().name === 'createMessage'
    ) {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}
