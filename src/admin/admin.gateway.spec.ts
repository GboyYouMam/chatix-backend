import { Test } from '@nestjs/testing';
import { AdminGateway } from './admin.gateway';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { Socket } from 'socket.io';

describe('AdminGateway', () => {
  const auth = { authenticate: jest.fn() };
  let gateway: AdminGateway;
  beforeEach(async () => {
    auth.authenticate
      .mockReset()
      .mockResolvedValue({ userId: 'u1', username: 'user', role: 'user' });
    const module = await Test.createTestingModule({
      providers: [
        AdminGateway,
        { provide: WsAuthService, useValue: auth },
        {
          provide: RealtimeService,
          useValue: { register: jest.fn(), emitToAdmins: jest.fn() },
        },
      ],
    }).compile();
    gateway = module.get(AdminGateway);
  });
  it('disconnects non-admin users', async () => {
    const emit = jest.fn();
    const disconnect = jest.fn();
    const client = {
      id: 's1',
      data: {},
      handshake: { auth: { token: 'jwt' } },
      emit,
      disconnect,
    } as unknown as Socket;
    await gateway.handleConnection(client);
    expect(emit).toHaveBeenCalledWith('exception', {
      message: 'admins only, chud',
    });
    expect(disconnect).toHaveBeenCalledWith(true);
  });
});
