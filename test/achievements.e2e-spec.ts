import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';
import { AchievementsService } from '../src/achievements/achievements.service';
import { userAchievements } from '../src/database/scheme';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/database/database.types';
import { FightClubRepository } from '../src/fight-club/fight-club.repository';
import { fights, rooms, users } from '../src/database/scheme';

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

  it('tracks aura farming and committed fight results without changing admin titles', async () => {
    const winner = await registerAndLogin(app, 'farm_winner', 'StrongPass1!');
    const loser = await registerAndLogin(app, 'farm_loser', 'StrongPass1!');
    await request(app.getHttpServer())
      .post('/users/farm-aura')
      .set('Authorization', `Bearer ${winner.token}`)
      .expect(201);
    const service = app.get(AchievementsService);
    expect(
      await db.query.userAchievements.findFirst({
        where: eq(userAchievements.key, 'first_farm'),
      }),
    ).toBeTruthy();

    await db
      .update(users)
      .set({ forcedTitle: 'admin title' })
      .where(eq(users.id, winner.userId));
    await app
      .get(FightClubRepository)
      .settle(
        winner.userId,
        loser.userId,
        'aura',
        500,
        { player1Id: winner.userId, player2Id: loser.userId },
        'ko',
      );
    await service.evaluate(winner.userId, 'fight');
    const fight = await db.query.fights.findFirst({
      where: eq(fights.player1Id, winner.userId),
    });
    const updatedWinner = await db.query.users.findFirst({
      where: eq(users.id, winner.userId),
    });
    expect(fight).toMatchObject({ winnerId: winner.userId, outcome: 'ko' });
    expect(updatedWinner).toMatchObject({
      forcedTitle: 'admin title',
      fightTitle: 'true adam',
    });
    expect(
      await db.query.userAchievements.findFirst({
        where: eq(userAchievements.key, 'first_blood'),
      }),
    ).toBeTruthy();
  });

  it('grants the return medal and stores valid time zones from /users/me', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'grass_returner',
      'StrongPass1!',
    );
    await db
      .update(users)
      .set({ lastSeenAt: new Date(Date.now() - 8 * 86400000) })
      .where(eq(users.id, userId));
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-timezone', 'Europe/Kyiv')
      .expect(200);
    const updated = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    expect(updated?.timezone).toBe('Europe/Kyiv');
    expect(
      await db.query.userAchievements.findFirst({
        where: eq(userAchievements.key, 'actually_went_touch_grass'),
      }),
    ).toBeTruthy();
  });

  it('includes unlocked, featured, and active fight title data on profiles', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'profile_medals',
      'StrongPass1!',
    );
    await app.get(AchievementsService).grant(userId, 'first_farm');
    await db
      .update(users)
      .set({
        featuredAchievements: ['first_farm'],
        fightTitle: 'true adam',
        fightTitleUntil: new Date(Date.now() + 3600000),
      })
      .where(eq(users.id, userId));
    const response = await request(app.getHttpServer())
      .get('/users/profile/profile_medals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const profile = response.body as {
      featuredAchievements: string[];
      fightTitle: string | null;
      achievements: Array<{ key: string }>;
    };
    expect(profile).toMatchObject({
      featuredAchievements: ['first_farm'],
      fightTitle: 'true adam',
    });
    expect(profile.achievements).toEqual([
      expect.objectContaining({ key: 'first_farm' }),
    ]);
  });

  it('grants landlord, ratio_d and admins_favourite from admin actions', async () => {
    const creator = await registerAndLogin(
      app,
      'room_landlord',
      'StrongPass1!',
    );
    const admin = await registerAndLogin(app, 'medal_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const [room] = await db
      .insert(rooms)
      .values({ creatorId: creator.userId, title: 'medal room' })
      .returning({ id: rooms.id });
    const headers = { Authorization: `Bearer ${admin.token}` };
    const hasMedal = async (key: string) =>
      Boolean(
        await db.query.userAchievements.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.userId, creator.userId), eq(table.key, key)),
        }),
      );

    await request(app.getHttpServer())
      .patch(`/admin/rooms/${room.id}/approve`)
      .set(headers)
      .expect(200);
    expect(await hasMedal('landlord')).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/rooms/${room.id}/quarantine`)
      .set(headers)
      .send({ reason: 'too cooked' })
      .expect(200);
    expect(await hasMedal('ratio_d')).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/users/${creator.userId}/modifiers`)
      .set(headers)
      .send({ adminGlazeMode: true })
      .expect(200);
    expect(await hasMedal('admins_favourite')).toBe(true);
  });
});
