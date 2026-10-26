import { ForbiddenException } from '@nestjs/common';

export class BannedException extends ForbiddenException {
  constructor(bannedUntil: Date, banReason: string | null) {
    super({
      code: 'BANNED',
      message: 'u banned, chud',
      bannedUntil: bannedUntil.toISOString(),
      banReason,
    });
  }
}
