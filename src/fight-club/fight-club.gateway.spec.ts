import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';

describe('FightClubGateway', () => {
  let gateway: FightClubGateway;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FightClubGateway,
        { provide: FightClubService, useValue: { server: null } },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<FightClubGateway>(FightClubGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('disconnects unauthorized clients', async () => {
    const client = {
      handshake: { auth: {}, headers: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('fight:error', {
      message: 'FUH U ARE UNAUTHORIZED GET OUT',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
