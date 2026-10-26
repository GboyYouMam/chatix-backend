import { Test } from '@nestjs/testing';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { Socket } from 'socket.io';

describe('FightClubGateway', () => {
  let gateway: FightClubGateway;
  const auth = { authenticate: jest.fn() };
  beforeEach(async () => {
    auth.authenticate.mockReset().mockRejectedValue(new Error('bad token'));
    const module = await Test.createTestingModule({
      providers: [
        FightClubGateway,
        { provide: FightClubService, useValue: { server: null } },
        { provide: WsAuthService, useValue: auth },
        { provide: RealtimeService, useValue: { register: jest.fn() } },
      ],
    }).compile();
    gateway = module.get(FightClubGateway);
  });
  it('disconnects clients rejected by shared authentication', async () => {
    const emit = jest.fn();
    const disconnect = jest.fn();
    const client = {
      id: 's',
      handshake: { auth: {} },
      data: {},
      emit,
      disconnect,
    } as unknown as Socket;
    await gateway.handleConnection(client);
    expect(emit).toHaveBeenCalledWith('exception', {
      message: 'unauthorized',
    });
    expect(disconnect).toHaveBeenCalledWith(true);
  });
});
