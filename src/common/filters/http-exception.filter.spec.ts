import { BadRequestException, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { BannedException } from '../errors/banned.exception';

describe('AllExceptionsFilter', () => {
  function run(error: unknown) {
    const response: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'rid' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    new AllExceptionsFilter().catch(error, host);
    return response;
  }
  it('preserves ban details and request id', () => {
    const response = run(new BannedException(new Date('2030-01-01'), 'lol'));
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'BANNED',
        bannedUntil: '2030-01-01T00:00:00.000Z',
        banReason: 'lol',
        requestId: 'rid',
      }),
    );
  });
  it('joins validation messages and hides unknown errors', () => {
    expect(run(new BadRequestException(['a', 'b'])).json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'a; b' }),
    );
    const response = run(new Error('secret')).json.mock.calls[0][0];
    expect(response.statusCode).toBe(500);
    expect(response.message).not.toContain('secret');
  });
});
