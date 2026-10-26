import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, registerAndLogin } from './utils/test-app';
import { userWarnings } from '../src/database/scheme';
import { eq } from 'drizzle-orm';
import { users } from '../src/database/scheme';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('users warnings profile (e2e)', () => {
  let app: INestApplication;
  let db: Awaited<ReturnType<typeof createTestApp>>['db'];
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
  afterAll(async () => close?.());

  it('shows only active warnings without the issuing admin', async () => {
    const user = await registerAndLogin(app, 'profile_user', 'StrongPass1!');
    const admin = await registerAndLogin(app, 'warning_admin', 'StrongPass1!');
    await db
      .insert(userWarnings)
      .values({ userId: user.userId, adminId: admin.userId, reason: 'active' })
      .returning();
    await db.insert(userWarnings).values({
      userId: user.userId,
      adminId: admin.userId,
      reason: 'revoked',
      revokedAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .get('/users/profile/profile_user')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    const profile = response.body as {
      activeWarnings: { reason: string; createdAt: string }[];
    };
    expect(profile.activeWarnings).toHaveLength(1);
    expect(profile.activeWarnings[0]).toMatchObject({ reason: 'active' });
    expect(profile.activeWarnings[0]).not.toHaveProperty('adminId');
  });

  it('applies concurrent aura farming increments without lost updates', async () => {
    const user = await registerAndLogin(app, 'farmer', 'StrongPass1!');
    const [before] = await db
      .select({ aura: users.aura })
      .from(users)
      .where(eq(users.id, user.userId));

    await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post('/users/farm-aura')
          .set('Authorization', `Bearer ${user.token}`)
          .expect(201),
      ),
    );

    const [after] = await db
      .select({ aura: users.aura })
      .from(users)
      .where(eq(users.id, user.userId));
    expect(after.aura).toBe(before.aura + 20);
  });
});
