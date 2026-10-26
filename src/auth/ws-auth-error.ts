import { HttpException } from '@nestjs/common';

export function wsAuthError(error: unknown): Record<string, unknown> {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      body.code === 'BANNED'
    ) {
      const { message, code, bannedUntil, banReason } = body as Record<
        string,
        unknown
      >;
      return { message, code, bannedUntil, banReason };
    }
  }
  return { message: 'unauthorized' };
}
