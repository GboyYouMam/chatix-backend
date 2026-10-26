import { WsAuthService } from './ws-auth.service';
it('strips optional bearer prefix and stores validated user', async () => {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u' }) };
  const validator = { validate: jest.fn().mockResolvedValue({ userId: 'u' }) };
  const auth = new WsAuthService(jwt as never, validator as never);
  for (const token of ['Bearer x', 'x']) {
    const client: any = { handshake: { auth: { token } }, data: {}, id: 's' };
    await auth.authenticate(client);
    expect(jwt.verifyAsync).toHaveBeenLastCalledWith('x');
    expect(client.data.user).toEqual({ userId: 'u' });
  }
});
