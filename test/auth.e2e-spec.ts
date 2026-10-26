import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, registerAndLogin, banUser } from './utils/test-app';
import { eq } from 'drizzle-orm';
import { users } from '../src/database/scheme';
import type { Db } from '../src/database/database.types';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('auth (e2e)', () => {
  let app: INestApplication;
  let db: Db;
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = testApp.db;
    reset = () => testApp.reset();
    close = () => testApp.close();
  });
  beforeEach(async () => reset());
  afterAll(async () => {
    await close?.();
  });
  const password = 'StrongPass1!';
  it('registers, logs in, checks current user, bans, and invalidates old token versions', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'auth_user',
      password,
    );
    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.headers['x-request-id']).toBeTruthy();
    await banUser(db, userId, new Date(Date.now() + 86400000), 'test ban');
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect((response) =>
        expect((response.body as { code: string }).code).toBe('BANNED'),
      );
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'auth_user', password })
      .expect(403)
      .expect((response) =>
        expect((response.body as { code: string }).code).toBe('BANNED'),
      );
    await db
      .update(users)
      .set({ bannedUntil: null, tokenVersion: 1 })
      .where(eq(users.id, userId));
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
