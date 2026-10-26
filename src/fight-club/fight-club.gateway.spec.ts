import { Test } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';
import { RealtimeService } from '../realtime/realtime.service';
import { WsAuthService } from '../auth/ws-auth.service';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';
import type { FightUpdate, HitResult } from './types/types';

describe('FightClubGateway', () => {
  let gateway: FightClubGateway;
  let service: {
    listChallenges: jest.Mock;
    handleHit: jest.Mock;
  };
  const auth = { authenticate: jest.fn() };

  beforeEach(async () => {
    auth.authenticate.mockReset().mockRejectedValue(new Error('bad token'));
    service = {
      listChallenges: jest.fn().mockReturnValue([]),
      handleHit: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        FightClubGateway,
        { provide: FightClubService, useValue: service },
        { provide: WsAuthService, useValue: auth },
        { provide: RealtimeService, useValue: { register: jest.fn() } },
      ],
    }).compile();
    gateway = module.get(FightClubGateway);
  });

  const makeClient = (id = 's1') => {
    const emit = jest.fn();
    const disconnect = jest.fn();
    return {
      emit,
      disconnect,
      socket: {
        id,
        handshake: { auth: {} },
        data: { user: { userId: 'p1', username: 'one', role: 'user' } },
        emit,
        disconnect,
      } as unknown as Socket,
    };
  };

  it('disconnects clients rejected by shared authentication', async () => {
    const { socket, emit, disconnect } = makeClient();
    await gateway.handleConnection(socket);
    expect(emit).toHaveBeenCalledWith('exception', {
      message: 'unauthorized',
    });
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('emits the update before game over on knockout', async () => {
    const events: string[] = [];
    const roomEmit = jest.fn((event: string) => events.push(event));
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
    } as unknown as Server;
    const update: FightUpdate = {
      matchId: '00000000-0000-4000-8000-000000000001',
      hp: { p1: 30, p2: 0 },
      combo: { p1: 1, p2: 0 },
      prompt: {
        promptId: '00000000-0000-4000-8000-000000000002',
        key: 'A',
      },
    };
    const result: HitResult = {
      kind: 'ko',
      update,
      winnerId: 'p1',
      loserId: 'p2',
      stakeType: 'aura',
      stakeAmount: 50,
    };
    service.handleHit.mockResolvedValue(result);
    const { socket } = makeClient();

    await gateway.handleHit(socket, {
      matchId: update.matchId,
      promptId: update.prompt.promptId,
      k: 'A',
    });

    expect(events).toEqual(['fight:update', 'fight:game_over']);
    expect(roomEmit).toHaveBeenNthCalledWith(1, 'fight:update', update);
    expect(roomEmit).toHaveBeenNthCalledWith(2, 'fight:game_over', {
      winnerId: 'p1',
      loserId: 'p2',
      stakeType: 'aura',
      stakeAmount: 50,
    });
  });

  it('does not send a client event for rejected hits', async () => {
    service.handleHit.mockResolvedValue({
      kind: 'rejected',
      reason: 'foreign_socket',
    } satisfies HitResult);
    const { socket, emit } = makeClient();

    await gateway.handleHit(socket, {
      matchId: '00000000-0000-4000-8000-000000000001',
      promptId: '00000000-0000-4000-8000-000000000002',
      k: 'A',
    });

    expect(emit).not.toHaveBeenCalled();
  });
});
