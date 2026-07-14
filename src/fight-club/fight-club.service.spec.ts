import { Test, TestingModule } from '@nestjs/testing';
import { FightClubService } from './fight-club.service';
import { FightClubRepository } from './fight-club.repository';

describe('FightClubService', () => {
  let service: FightClubService;
  let repo: { summariseFight: jest.Mock };

  beforeEach(async () => {
    repo = { summariseFight: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FightClubService,
        { provide: FightClubRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<FightClubService>(FightClubService);
    service.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('damages, crits, and finishes from memory', async () => {
    const client = { emit: jest.fn(), id: 's1' } as any;

    service.joinMatch(client, {
      matchId: 'm1',
      userId: 'p1',
      opponentId: 'p2',
      stakeType: 'aura',
      stakeAmount: 7,
    });

    const match = (service as any).activeMatches.get('m1');
    match.player2.socketId = 's2';
    service.startMatch('m1');
    match.currentKey = 'A';
    match.player2.hp = 6;

    await service.handleHit(client, 'm1', 'p1', 'a');
    match.currentKey = 'B';
    await service.handleHit(client, 'm1', 'p1', 'B');
    match.currentKey = 'C';
    await service.handleHit(client, 'm1', 'p1', 'C');

    expect(repo.summariseFight).toHaveBeenCalledWith('p1', 'p2', 'aura', 7);
    expect((service as any).activeMatches.has('m1')).toBe(false);
  });
});
