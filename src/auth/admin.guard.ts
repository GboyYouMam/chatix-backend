import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (user && user.role === 'admin') {
            return true;
        }

        throw new ForbiddenException('Hell nah u`re not an admin tf are u doin');
    }
}