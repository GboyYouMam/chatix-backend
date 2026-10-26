import { WsAuthService } from './ws-auth.service';
import type { Socket } from 'socket.io';
import type { SocketUserData } from './socket-user';
it('strips optional bearer prefix and stores validated user', async () => {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u' }) };
  const validator = { validate: jest.fn().mockResolvedValue({ userId: 'u' }) };
  const auth = new WsAuthService(jwt as never, validator as never);
  for (const token of ['Bearer x', 'x']) {
    const data: SocketUserData = {};
    const client = {
      handshake: { auth: { token } },
      data,
      id: 's',
    } as unknown as Socket & { data: SocketUserData };
    await auth.authenticate(client);
    expect(jwt.verifyAsync).toHaveBeenLastCalledWith('x');
    expect(data.user).toEqual({ userId: 'u' });
  }
});
