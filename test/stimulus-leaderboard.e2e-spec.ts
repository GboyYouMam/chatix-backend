import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';
import type { StimulusResult } from '../src/economy/stimulus.service';
import type { LeaderboardResult } from '../src/economy/leaderboard.service';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('stimulus and leaderboard (e2e)', () => {
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
  }, 60_000);
  beforeEach(async () => reset());
  afterAll(async () => close?.());

  const claim = (token: string) =>
    request(app.getHttpServer())
      .post('/economy/stimulus')
      .set('Authorization', `Bearer ${token}`);

  const getUser = async (userId: string) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return user;
  };

  it('grants exactly once when two stimulus calls race', async () => {
    const user = await registerAndLogin(app, 'stim_racer', 'StrongPass1!');
    const before = (await getUser(user.userId)).aura;

    const responses = await Promise.all([claim(user.token), claim(user.token)]);

    const bodies = responses.map((response) => response.body as StimulusResult);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(bodies.filter((body) => body.granted)).toHaveLength(1);
    expect(bodies.find((body) => !body.granted)).toMatchObject({
      granted: false,
      amount: 0,
    });
    const after = await getUser(user.userId);
    expect(after.aura).toBe(before + 10);
    expect(after.stimulusStreak).toBe(1);
  });

  it('grants nothing on a second call the same UTC day', async () => {
    const user = await registerAndLogin(app, 'stim_twice', 'StrongPass1!');
    await claim(user.token).expect(201);

    const second = await claim(user.token).expect(201);

    expect(second.body).toMatchObject({ granted: false, amount: 0, streak: 1 });
    expect((await getUser(user.userId)).aura).toBe(1010);
  });

  it('resets the streak to 1 after a missed day', async () => {
    const user = await registerAndLogin(app, 'stim_lapsed', 'StrongPass1!');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await db
      .update(schema.users)
      .set({ stimulusStreak: 5, lastStimulusAt: threeDaysAgo })
      .where(eq(schema.users.id, user.userId));

    const response = await claim(user.token).expect(201);

    expect(response.body).toMatchObject({
      granted: true,
      amount: 10,
      streak: 1,
      streakReset: true,
    });
    expect((await getUser(user.userId)).stimulusStreak).toBe(1);
  });

  it('orders the leaderboard by aura descending', async () => {
    const low = await registerAndLogin(app, 'board_low', 'StrongPass1!');
    const high = await registerAndLogin(app, 'board_high', 'StrongPass1!');
    const mid = await registerAndLogin(app, 'board_mid', 'StrongPass1!');
    await db
      .update(schema.users)
      .set({ aura: 5000 })
      .where(eq(schema.users.id, high.userId));
    await db
      .update(schema.users)
      .set({ aura: 3000 })
      .where(eq(schema.users.id, mid.userId));
    await db
      .update(schema.users)
      .set({ aura: 10 })
      .where(eq(schema.users.id, low.userId));

    const response = await request(app.getHttpServer())
      .get('/economy/leaderboard')
      .expect(200);

    const board = response.body as LeaderboardResult;
    const names = board.mostAura.map((entry) => entry.username);
    expect(names.slice(0, 3)).toEqual(['board_high', 'board_mid', 'board_low']);
    expect(board.mostAura[0]).toEqual({
      username: 'board_high',
      pfp_url: null,
      value: 5000,
    });
  });

  it('counts the loser of each ko or rage quit as mogged this week', async () => {
    const winner = await registerAndLogin(app, 'mog_winner', 'StrongPass1!');
    const loser = await registerAndLogin(app, 'mog_loser', 'StrongPass1!');
    const fight = {
      stakeType: 'aura',
      stakeAmount: 10,
      winnerId: winner.userId,
      outcome: 'ko' as const,
    };
    await db.insert(schema.fights).values([
      { ...fight, player1Id: winner.userId, player2Id: loser.userId },
      { ...fight, player1Id: loser.userId, player2Id: winner.userId },
      {
        ...fight,
        player1Id: winner.userId,
        player2Id: loser.userId,
        outcome: 'cancelled',
        winnerId: null,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/economy/leaderboard?week=current')
      .expect(200);

    const board = response.body as LeaderboardResult;
    expect(board.mostMogged).toEqual([
      { username: 'mog_loser', pfp_url: null, value: 2 },
    ]);
  });
});
