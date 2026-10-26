import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('Security controls (e2e)', () => {
  let app: INestApplication;
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  let token: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    reset = () => testApp.reset();
    close = () => testApp.close();
    await reset();
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'security_user', password: 'Password123!' })
      .expect(201);
    token = (response.body as { access_token: string }).access_token;
  });
  afterAll(async () => close?.());

  it('limits login attempts to five per minute', async () => {
    const credentials = { username: 'security_user', password: 'Password123!' };
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer()).post('/auth/login').send(credentials),
      ),
    );
    expect(responses.map(({ status }) => status)).toContain(429);
    const limited = responses.find(({ status }) => status === 429);
    expect((limited?.body as { message: string }).message).toBe(
      'chill. too many requests.',
    );
  });

  it('limits message posts by authenticated user', async () => {
    const responses = await Promise.all(
      Array.from({ length: 21 }, () =>
        request(app.getHttpServer())
          .post('/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ roomId: randomUUID(), cipherText: 'hello' }),
      ),
    );
    expect(responses.map(({ status }) => status)).toContain(429);
  });

  it('does not throttle aura farming', async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        request(app.getHttpServer())
          .post('/users/farm-aura')
          .set('Authorization', `Bearer ${token}`),
      ),
    );
    expect(responses.every(({ status }) => status !== 429)).toBe(true);
    const profile = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((profile.body as { aura: number }).aura).toBe(1030);
  });

  it('allows only configured CORS origins and sets helmet headers', async () => {
    const evil = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();

    const allowed = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  });
});
