import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createTestApp, registerAndLogin } from './utils/test-app';
import * as schema from '../src/database/scheme';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('Users security and warnings (e2e)', () => {
  let app: INestApplication;
  let db: Awaited<ReturnType<typeof createTestApp>>['db'];
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = testApp.db;
    reset = () => testApp.reset();
    close = () => testApp.close();
  });
  beforeEach(async () => {
    await reset();
    ({ token, userId } = await registerAndLogin(
      app,
      'profile_user',
      'Password123!',
    ));
  });
  afterAll(async () => close?.());

  it('shows only active warnings without the issuing admin', async () => {
    const admin = await registerAndLogin(app, 'warning_admin', 'StrongPass1!');
    await db.insert(schema.userWarnings).values([
      { userId, adminId: admin.userId, reason: 'active' },
      {
        userId,
        adminId: admin.userId,
        reason: 'revoked',
        revokedAt: new Date(),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/users/profile/profile_user')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    const profile = response.body as {
      activeWarnings: { reason: string; createdAt: string }[];
    };
    expect(profile.activeWarnings).toHaveLength(1);
    expect(profile.activeWarnings[0]).toMatchObject({ reason: 'active' });
    expect(profile.activeWarnings[0]).not.toHaveProperty('adminId');
  });

  it('paginates profile comments newest first', async () => {
    const base = Date.now();
    await db.insert(schema.profileComments).values(
      Array.from({ length: 12 }, (_, index) => ({
        profileUserId: userId,
        authorId: userId,
        body: `comment ${index + 1}`,
        createdAt: new Date(base + index * 1000),
      })),
    );

    const first = await request(app.getHttpServer())
      .get('/users/profile/profile_user/comments?page=1&limit=10')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    const firstBody = first.body as {
      items: { body: string }[];
      page: number;
      limit: number;
      total: number;
    };
    expect(firstBody.items).toHaveLength(10);
    expect(firstBody.items[0].body).toBe('comment 12');
    expect(firstBody).toMatchObject({ page: 1, limit: 10, total: 12 });

    const second = await request(app.getHttpServer())
      .get('/users/profile/profile_user/comments?page=2&limit=10')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    const secondBody = second.body as {
      items: { body: string }[];
      total: number;
    };
    expect(secondBody.items).toHaveLength(2);
    expect(secondBody.items[1].body).toBe('comment 1');
    expect(secondBody.total).toBe(12);

    await request(app.getHttpServer())
      .get('/users/profile/profile_user/comments?limit=51')
      .set('Authorization', 'Bearer ' + token)
      .expect(400);
  });

  it('applies concurrent aura farming increments without lost updates', async () => {
    const [before] = await db
      .select({ aura: schema.users.aura })
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post('/users/farm-aura')
          .set('Authorization', 'Bearer ' + token)
          .expect(201),
      ),
    );

    const [after] = await db
      .select({ aura: schema.users.aura })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(after.aura).toBe(before.aura + 20);
  });

  it('rejects mass assignment and preserves the user role', async () => {
    await request(app.getHttpServer())
      .post('/users/update')
      .set('Authorization', 'Bearer ' + token)
      .send({ role: 'admin' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect((response.body as { role: string }).role).toBe('user');
  });

  it('rejects usernames that fail registration rules', async () => {
    await request(app.getHttpServer())
      .post('/users/update')
      .set('Authorization', 'Bearer ' + token)
      .send({ username: 'a b' })
      .expect(400);
  });

  it('blocks profile changes when an admin freezes the profile', async () => {
    await db
      .update(schema.users)
      .set({ canChangeProfile: false })
      .where(eq(schema.users.id, userId));

    await request(app.getHttpServer())
      .post('/users/update')
      .set('Authorization', 'Bearer ' + token)
      .send({ vibe: 'frozen' })
      .expect(403);
  });
});
