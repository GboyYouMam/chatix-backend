import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, registerAndLogin } from './utils/test-app';
import { AchievementsService } from '../src/achievements/achievements.service';
import { userAchievements } from '../src/database/scheme';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/database/database.types';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('achievements (e2e)', () => {
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
  afterAll(async () => close?.());

  it('grants a medal once under concurrent requests and masks secret catalog entries per user', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'medal_user',
      'StrongPass1!',
    );
    const service = app.get(AchievementsService);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.grant(userId, 'first_farm')),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId)),
    ).toHaveLength(1);

    const before = await request(app.getHttpServer())
      .get('/achievements/catalog')
      .expect(200);
    const beforeCatalog = before.body as Array<{
      key: string;
      name: string;
      description: string;
    }>;
    expect(
      beforeCatalog.find((item) => item.key === 'found_the_basement'),
    ).toMatchObject({ name: '???', description: 'secret. go find it.' });
    await request(app.getHttpServer())
      .post('/achievements/discover')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'first_rule' })
      .expect(201);
    const after = await request(app.getHttpServer())
      .get('/achievements/catalog')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterCatalog = after.body as Array<{ key: string; name: string }>;
    expect(afterCatalog.find((item) => item.key === 'first_rule')?.name).toBe(
      'first rule',
    );
  });

  it('rejects featuring a locked medal and discovering a non-secret medal', async () => {
    const { token } = await registerAndLogin(
      app,
      'medal_user2',
      'StrongPass1!',
    );
    await request(app.getHttpServer())
      .patch('/users/me/featured-achievements')
      .set('Authorization', `Bearer ${token}`)
      .send({ keys: ['first_farm'] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/achievements/discover')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'first_farm' })
      .expect(400);
  });
});
