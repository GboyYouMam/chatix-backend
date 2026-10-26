import { BadRequestException, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { AllExceptionsFilter } from './http-exception.filter';
import { BannedException } from '../errors/banned.exception';

describe('AllExceptionsFilter', () => {
  function run(error: unknown) {
    let body: unknown;
    let statusCode = 0;
    const response = {
      status(code: number) {
        statusCode = code;
        return response;
      },
      json(value: unknown) {
        body = value;
        return response;
      },
    } as unknown as Response & { statusCode: number };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'rid' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    new AllExceptionsFilter().catch(error, host);
    return { response, statusCode: () => statusCode, body: () => body };
  }
  it('preserves ban details and request id', () => {
    const result = run(new BannedException(new Date('2030-01-01'), 'lol'));
    expect(result.statusCode()).toBe(403);
    expect(result.body()).toEqual(
      expect.objectContaining({
        code: 'BANNED',
        bannedUntil: '2030-01-01T00:00:00.000Z',
        banReason: 'lol',
        requestId: 'rid',
      }),
    );
  });
  it('joins validation messages and hides unknown errors', () => {
    expect(run(new BadRequestException(['a', 'b'])).body()).toEqual(
      expect.objectContaining({ message: 'a; b' }),
    );
    const result = run(new Error('secret'));
    const body = result.body() as { statusCode: number; message: string };
    expect(body.statusCode).toBe(500);
    expect(body.message).not.toContain('secret');
  });
});
