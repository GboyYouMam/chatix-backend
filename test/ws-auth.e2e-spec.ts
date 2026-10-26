import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import {
  banUser,
  createTestApp,
  registerAndLogin,
} from './utils/test-app';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
type ConnectErrorData = { message?: string; code?: string };

describe('socket authentication (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  const connect = (namespace: string, token: string) => {
    const socket = io(`${baseUrl}${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };

  const connectError = (socket: Socket) =>
    new Promise<ConnectErrorData | undefined>((resolve) =>
      socket.on('connect_error', (err: Error & { data?: ConnectErrorData }) =>
        resolve(err.data),
      ),
    );

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => ctx.reset());

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(() => ctx.close());

  it('handles an event emitted immediately on connect', async () => {
    const { token } = await registerAndLogin(app, 'ws_fast', 'Fast1234!');
    const socket = connect('/fight-club', token);

    const created = new Promise<{ title: string }>((resolve) =>
      socket.on('fight:challenge_created', resolve),
    );
    socket.on('connect', () => {
      socket.emit('fight:create', {
        title: 'no race',
        stakeType: 'aura',
        stakeAmount: 10,
      });
    });

    await expect(created).resolves.toMatchObject({ title: 'no race' });
  });

  it('rejects a banned user with the ban payload', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'ws_banned',
      'Banned123!',
    );
    await banUser(ctx.db, userId, new Date(Date.now() + 60_000), 'lol');

    const data = await connectError(connect('/', token));

    expect(data).toMatchObject({ code: 'BANNED', banReason: 'lol' });
  });

  it('rejects non-admins on the admin namespace', async () => {
    const { token } = await registerAndLogin(app, 'ws_user', 'User1234!');

    const data = await connectError(connect('/admin', token));

    expect(data).toEqual({ message: 'admins only, chud' });
  });
});
