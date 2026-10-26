import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsExceptionsFilter } from './ws-exception.filter';
it('emits a normalized exception event', () => {
  const client = { id: 's1', data: {}, emit: jest.fn() };
  const host = {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ArgumentsHost;
  new WsExceptionsFilter().catch(new WsException('nope'), host);
  expect(client.emit).toHaveBeenCalledWith('exception', { message: 'nope' });
});
