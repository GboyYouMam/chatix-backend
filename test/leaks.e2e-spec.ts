import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, registerAndLogin } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('public payload privacy (e2e)', () => {
  let app: INestApplication;
  let reset: () => Promise<void>;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    reset = () => testApp.reset();
    close = () => testApp.close();
  });
  beforeEach(async () => reset());
  afterAll(async () => close?.());

  it('keeps sensitive user and IP fields out of public room and message payloads', async () => {
    const { token } = await registerAndLogin(app, 'leak_owner', 'Password123!');
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'privacy test room', publicity: 'public' })
      .expect(201);
    const roomId = (created.body as { id: string }).id;
    const message = await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, cipherText: 'public message' })
      .expect(201);

    const responses = await Promise.all([
      request(app.getHttpServer()).get('/rooms').expect(200),
      request(app.getHttpServer()).get(`/rooms/${roomId}`).expect(200),
      request(app.getHttpServer())
        .get('/rooms/by-name/privacy%20test%20room')
        .expect(200),
      request(app.getHttpServer())
        .get(`/messages/${roomId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200),
    ]);
    const payloads: unknown[] = responses.map(({ body }) => body as unknown);
    payloads.push(message.body as unknown);
    const forbidden = new Set([
      'password',
      'tokenVersion',
      'ipAddress',
      'banReason',
      'bannedUntil',
    ]);
    const keys = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return (value as unknown[]).flatMap((child) => keys(child));
      }
      if (!value || typeof value !== 'object') return [];
      const record = value as Record<string, unknown>;
      return Object.keys(record).flatMap((key) => [key, ...keys(record[key])]);
    };

    for (const payload of payloads) {
      expect(keys(payload).filter((key) => forbidden.has(key))).toEqual([]);
    }
    expect((message.body as { ipTag: string }).ipTag).toMatch(
      /^\d+\.\d+\.\d+\.#[a-f0-9]{3}$/,
    );
  });
});
