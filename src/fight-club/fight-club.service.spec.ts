import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { RequestUser } from '../auth/dto/request-user.dto';
import type { Server, Socket } from 'socket.io';
import { FightClubRepository } from './fight-club.repository';
import { FightClubService } from './fight-club.service';
import type { MatchState } from './types/types';
import { AchievementsService } from '../achievements/achievements.service';

describe('FightClubService', () => {
  let service: FightClubService;
  let repo: { settle: jest.Mock; countRecentFights: jest.Mock };
  let roomEmit: jest.Mock;
  let serverEmit: jest.Mock;
  let fetchSockets: jest.Mock;
  let matches: Map<string, MatchState>;

  const creator: RequestUser = {
    userId: 'p1',
    username: 'one',
    role: 'user',
  };
  const challenger: RequestUser = {
    userId: 'p2',
    username: 'two',
    role: 'user',
  };
  const makeSocket = (id: string) =>
    ({ id, emit: jest.fn(), join: jest.fn() }) as unknown as Socket;

  const createChallenge = () => {
    const challenge = service.createMatch(creator, 's-lobby', {
      title: 'basement duel',
      stakeType: 'aura',
      stakeAmount: 7,
    });
    return { matchId: challenge.id };
  };

  const createLobby = () => {
    const { matchId } = createChallenge();
    const state = service.joinMatch(creator, 's-duel-1', {
      matchId,
    });
    return { matchId, state };
  };

  const makeFight = () => {
    const { matchId } = createLobby();
    service.joinMatch(challenger, 's-duel-2', { matchId });
    service.startMatch(matchId, 1000);
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    return { matchId, creatorSocket: makeSocket(match.player1.socketId) };
  };

  beforeEach(async () => {
    repo = {
      settle: jest.fn(),
      countRecentFights: jest.fn().mockResolvedValue(0),
      isClown: jest.fn().mockResolvedValue(false),
      recordCancelled: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FightClubService,
        { provide: FightClubRepository, useValue: repo },
        {
          provide: AchievementsService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue(undefined),
            grantSafely: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<FightClubService>(FightClubService);
    roomEmit = jest.fn();
    serverEmit = jest.fn();
    fetchSockets = jest.fn().mockResolvedValue([]);
    service.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      in: jest.fn().mockReturnValue({ fetchSockets }),
      emit: serverEmit,
    } as unknown as Server;
    matches = (service as unknown as { activeMatches: Map<string, MatchState> })
      .activeMatches;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('damages, crits, and settles a knockout', async () => {
    const { matchId, creatorSocket } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    match.player2.hp = 6;

    for (let index = 0; index < 3; index += 1) {
      const prompt = match.prompt;
      const result = await service.handleHit(
        creator.userId,
        creatorSocket.id,
        { matchId, promptId: prompt.promptId, k: prompt.key.toLowerCase() },
        prompt.sentAt + 150,
      );
      expect(result.kind).toBe(index < 2 ? 'hit' : 'ko');
    }

    expect(repo.settle).toHaveBeenCalledWith(
      'p1',
      'p2',
      'aura',
      7,
      { player1Id: 'p1', player2Id: 'p2' },
      'ko',
    );
    expect(matches.has(matchId)).toBe(false);
  });

  it('rejects stale prompts, including a prompt after it was used', async () => {
    const { matchId, creatorSocket } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    const oldPromptId = match.prompt.promptId;
    await service.handleHit(
      creator.userId,
      creatorSocket.id,
      { matchId, promptId: oldPromptId, k: match.prompt.key },
      1150,
    );
    const currentPrompt = match.prompt;
    expect(currentPrompt.promptId).not.toBe(oldPromptId);
    const result = await service.handleHit(
      creator.userId,
      creatorSocket.id,
      { matchId, promptId: oldPromptId, k: currentPrompt.key },
      1300,
    );
    expect(result).toEqual({ kind: 'rejected', reason: 'stale_prompt' });
  });

  it('treats a hit before 120 ms as a miss and a hit at 120 ms as valid', async () => {
    const earlyFight = makeFight();
    const earlyPrompt = matches.get(earlyFight.matchId)?.prompt;
    if (!earlyPrompt) throw new Error('expected prompt');
    expect(
      await service.handleHit(
        creator.userId,
        earlyFight.creatorSocket.id,
        {
          matchId: earlyFight.matchId,
          promptId: earlyPrompt.promptId,
          k: earlyPrompt.key,
        },
        earlyPrompt.sentAt + 119,
      ),
    ).toEqual({ kind: 'miss', stunMs: 1000 });

    const validFight = makeFight();
    const validPrompt = matches.get(validFight.matchId)?.prompt;
    if (!validPrompt) throw new Error('expected prompt');
    expect(
      await service.handleHit(
        creator.userId,
        validFight.creatorSocket.id,
        {
          matchId: validFight.matchId,
          promptId: validPrompt.promptId,
          k: validPrompt.key,
        },
        validPrompt.sentAt + 120,
      ),
    ).toMatchObject({ kind: 'hit' });
  });

  it('rejects a non-player, foreign socket, and stunned player', async () => {
    const { matchId, creatorSocket } = makeFight();
    const prompt = matches.get(matchId)?.prompt;
    if (!prompt) throw new Error('expected prompt');
    const dto = { matchId, promptId: prompt.promptId, k: prompt.key };
    await expect(
      service.handleHit('other', creatorSocket.id, dto, 1200),
    ).resolves.toEqual({ kind: 'rejected', reason: 'not_player' });
    await expect(
      service.handleHit(creator.userId, 'foreign', dto, 1200),
    ).resolves.toEqual({ kind: 'rejected', reason: 'foreign_socket' });
    await service.handleHit(
      creator.userId,
      creatorSocket.id,
      { ...dto, k: '!' },
      1200,
    );
    await expect(
      service.handleHit(creator.userId, creatorSocket.id, dto, 1201),
    ).resolves.toEqual({ kind: 'rejected', reason: 'stunned' });
  });

  it('logs suspicious cadence once per player per match', async () => {
    const { matchId, creatorSocket } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    for (let index = 0; index < 13; index += 1) {
      const prompt = match.prompt;
      await service.handleHit(
        creator.userId,
        creatorSocket.id,
        { matchId, promptId: prompt.promptId, k: prompt.key },
        prompt.sentAt + 200,
      );
    }

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith({
      event: 'fight.suspicious_cadence',
      matchId,
      userId: creator.userId,
    });
  });

  it('starts only after both players join from their match sockets', () => {
    const { matchId } = createChallenge();
    service.joinMatch(challenger, 's2', { matchId });
    service.startMatch(matchId, 1000);
    expect(matches.get(matchId)?.status).toBe('LOBBY');

    service.joinMatch(creator, 's1-duel', { matchId });
    service.startMatch(matchId, 1000);
    expect(matches.get(matchId)?.status).toBe('FIGHTING');
  });

  it('keeps the creator lobby alive when they rejoin with a new socket', async () => {
    jest.useFakeTimers();
    const { matchId } = createChallenge();
    await service.handlePlayerDisconnect(creator.userId, 's-lobby');
    await jest.advanceTimersByTimeAsync(3_000);
    service.joinMatch(creator, 's-reconnected', { matchId });
    await jest.advanceTimersByTimeAsync(7_000);

    expect(matches.get(matchId)?.player1.socketId).toBe('s-reconnected');
    expect(service.getFightState(creator.userId, matchId)).toMatchObject({
      matchId,
      status: 'lobby',
    });
    expect(fetchSockets).not.toHaveBeenCalled();
  });

  it('removes a creator challenge after 10 seconds with no live namespace sockets', async () => {
    jest.useFakeTimers();
    const { matchId } = createChallenge();
    await service.handlePlayerDisconnect(creator.userId, 's-lobby');
    await jest.advanceTimersByTimeAsync(10_000);

    expect(service.getFightState(creator.userId, matchId)).toBeUndefined();
    expect(serverEmit).toHaveBeenCalledWith('fight:challenge_removed', {
      matchId,
    });
  });

  it('keeps a lobby challenge while another user socket is alive', async () => {
    jest.useFakeTimers();
    fetchSockets.mockResolvedValue([{ id: 's-other' }]);
    const { matchId } = createLobby();
    await service.handlePlayerDisconnect(creator.userId, 's-lobby');
    await jest.advanceTimersByTimeAsync(10_000);

    expect(service.getFightState(creator.userId, matchId)).toBeDefined();
  });

  it('rejects nonexistent matches and full lobbies', () => {
    expect(() =>
      service.joinMatch(creator, 's1', {
        matchId: '00000000-0000-4000-8000-000000000000',
      }),
    ).toThrow('match not found. it got cooked.');
    const { matchId } = createLobby();
    service.joinMatch(challenger, 's2', { matchId });
    expect(() =>
      service.joinMatch(
        { userId: 'p3', username: 'three', role: 'user' },
        's3',
        { matchId },
      ),
    ).toThrow('fight is full');
  });

  it('returns the creator as the challenger opponent and rage quits on fight disconnect', async () => {
    const { matchId } = createLobby();
    const state = service.joinMatch(challenger, 's2', { matchId });
    expect(state).toMatchObject({
      role: 'challenger',
      opponent: { id: creator.userId, username: creator.username },
    });
    service.startMatch(matchId, 1000);

    await service.handlePlayerDisconnect(challenger.userId, 's2');

    expect(roomEmit).toHaveBeenCalledWith(
      'fight:rage_quit',
      expect.objectContaining({ leaverId: challenger.userId }),
    );
  });

  it('reports settlement failure to the match and removes the match', async () => {
    const { matchId, creatorSocket } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    match.player2.hp = 1;
    repo.settle.mockRejectedValue(new Error('database unavailable'));
    const prompt = match.prompt;

    const result = await service.handleHit(
      creator.userId,
      creatorSocket.id,
      { matchId, promptId: prompt.promptId, k: prompt.key },
      prompt.sentAt + 120,
    );

    expect(result).toEqual({ kind: 'settlement_failed' });
    expect(roomEmit).toHaveBeenCalledWith('fight:error', {
      message: 'the soap market crashed. result not saved, try again.',
    });
    expect(matches.has(matchId)).toBe(false);
    expect(roomEmit).not.toHaveBeenCalledWith(
      'fight:game_over',
      expect.anything(),
    );
  });
});
