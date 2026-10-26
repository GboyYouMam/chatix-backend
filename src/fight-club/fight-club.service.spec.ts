import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';
import { FightClubRepository } from './fight-club.repository';
import { FightClubService } from './fight-club.service';
import type { MatchState } from './types/types';

describe('FightClubService', () => {
  let service: FightClubService;
  let repo: { summariseFight: jest.Mock };
  let roomEmit: jest.Mock;
  let matches: Map<string, MatchState>;

  const createSocket = (id: string) =>
    ({ id, emit: jest.fn(), join: jest.fn() }) as unknown as Socket;

  const makeFight = () => {
    const challenge = service.createMatch('p1', 'one', { stakeAmount: 7 });
    if (!challenge) throw new Error('expected challenge');
    const creator = createSocket('s1');
    const challenger = createSocket('s2');
    service.joinMatch(creator, { matchId: challenge.id, userId: 'p1' });
    service.joinMatch(challenger, { matchId: challenge.id, userId: 'p2' });
    service.startMatch(challenge.id, 1000);
    return { matchId: challenge.id, creator };
  };

  beforeEach(async () => {
    repo = { summariseFight: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FightClubService,
        { provide: FightClubRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<FightClubService>(FightClubService);
    roomEmit = jest.fn();
    service.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      emit: jest.fn(),
    } as unknown as Server;
    matches = (service as unknown as { activeMatches: Map<string, MatchState> })
      .activeMatches;
  });

  afterEach(() => jest.restoreAllMocks());

  it('damages, crits, and settles a knockout', async () => {
    const { matchId, creator } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    match.player2.hp = 6;

    for (let index = 0; index < 3; index += 1) {
      const prompt = match.prompt;
      const result = await service.handleHit(
        'p1',
        creator.id,
        { matchId, promptId: prompt.promptId, k: prompt.key.toLowerCase() },
        prompt.sentAt + 150,
      );
      if (index < 2) expect(result.kind).toBe('hit');
      else expect(result.kind).toBe('ko');
    }

    expect(repo.summariseFight).toHaveBeenCalledWith('p1', 'p2', 'aura', 7);
    expect(matches.has(matchId)).toBe(false);
  });

  it('rejects stale prompts, including a prompt after it was used', async () => {
    const { matchId, creator } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    const oldPromptId = match.prompt.promptId;
    await service.handleHit(
      'p1',
      creator.id,
      { matchId, promptId: oldPromptId, k: match.prompt.key },
      1150,
    );
    const currentPrompt = match.prompt;
    expect(currentPrompt.promptId).not.toBe(oldPromptId);
    const result = await service.handleHit(
      'p1',
      creator.id,
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
        'p1',
        earlyFight.creator.id,
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
        'p1',
        validFight.creator.id,
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
    const { matchId, creator } = makeFight();
    const prompt = matches.get(matchId)?.prompt;
    if (!prompt) throw new Error('expected prompt');
    const dto = { matchId, promptId: prompt.promptId, k: prompt.key };
    await expect(
      service.handleHit('other', creator.id, dto, 1200),
    ).resolves.toEqual({ kind: 'rejected', reason: 'not_player' });
    await expect(
      service.handleHit('p1', 'foreign', dto, 1200),
    ).resolves.toEqual({ kind: 'rejected', reason: 'foreign_socket' });
    await service.handleHit('p1', creator.id, { ...dto, k: '!' }, 1200);
    await expect(
      service.handleHit('p1', creator.id, dto, 1201),
    ).resolves.toEqual({ kind: 'rejected', reason: 'stunned' });
  });

  it('logs suspicious cadence once per player per match', async () => {
    const { matchId, creator } = makeFight();
    const match = matches.get(matchId);
    if (!match) throw new Error('expected match');
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    for (let index = 0; index < 13; index += 1) {
      const prompt = match.prompt;
      await service.handleHit(
        'p1',
        creator.id,
        { matchId, promptId: prompt.promptId, k: prompt.key },
        prompt.sentAt + 200,
      );
    }

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'fight.suspicious_cadence',
        matchId,
        userId: 'p1',
      }),
    );
  });
});
