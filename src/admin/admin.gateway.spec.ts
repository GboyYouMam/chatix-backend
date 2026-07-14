import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminGateway } from './admin.gateway';

describe('AdminGateway', () => {
  let gateway: AdminGateway;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<AdminGateway>(AdminGateway);
  });

  it('disconnects non-admin users', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u1',
      username: 'user',
      role: 'user',
    });
    const client = {
      id: 's1',
      data: {},
      handshake: { auth: { token: 'jwt' }, headers: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('admin:error', {
      message: 'Unauthorized',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
