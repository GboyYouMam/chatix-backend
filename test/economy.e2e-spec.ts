import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';
import { FightClubRepository } from '../src/fight-club/fight-club.repository';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('economy consumables (e2e)', () => {
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

  const grant = (userId: string, itemKey: string, quantity = 1) =>
    db.insert(schema.userInventory).values({ userId, itemKey, quantity });

  const use = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/shop/use')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const getUser = async (userId: string) => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return user;
  };

  it('lets exactly one of two concurrent uses of the last clown stamp succeed', async () => {
    const actor = await registerAndLogin(app, 'stamp_racer', 'StrongPass1!');
    const victimA = await registerAndLogin(
      app,
      'stamp_victim_a',
      'StrongPass1!',
    );
    const victimB = await registerAndLogin(
      app,
      'stamp_victim_b',
      'StrongPass1!',
    );
    await grant(actor.userId, 'clown_stamp', 1);

    const responses = await Promise.all([
      use(actor.token, {
        itemKey: 'clown_stamp',
        targetUserId: victimA.userId,
      }),
      use(actor.token, {
        itemKey: 'clown_stamp',
        targetUserId: victimB.userId,
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 403,
    ]);
    expect(
      responses.find((response) => response.status === 403)?.body,
    ).toMatchObject({ code: 'NOT_OWNED' });
    const effects = await db
      .select()
      .from(schema.profileEffects)
      .where(eq(schema.profileEffects.appliedById, actor.userId));
    expect(effects).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.userInventory)
        .where(eq(schema.userInventory.userId, actor.userId)),
    ).toHaveLength(0);
  });

  it('refuses a clown stamp on an admin and on yourself', async () => {
    const actor = await registerAndLogin(app, 'stamp_hater', 'StrongPass1!');
    const boss = await registerAndLogin(app, 'stamp_boss', 'StrongPass1!');
    await makeAdmin(db, boss.userId);
    await grant(actor.userId, 'clown_stamp', 2);

    const onAdmin = await use(actor.token, {
      itemKey: 'clown_stamp',
      targetUserId: boss.userId,
    }).expect(403);
    expect(onAdmin.body).toMatchObject({ code: 'ADMIN_TARGET' });

    await use(actor.token, {
      itemKey: 'clown_stamp',
      targetUserId: actor.userId,
    }).expect(400);

    const inventory = await db
      .select()
      .from(schema.userInventory)
      .where(eq(schema.userInventory.userId, actor.userId));
    expect(inventory).toEqual([
      expect.objectContaining({ itemKey: 'clown_stamp', quantity: 2 }),
    ]);
  });

  it('moves half the stake when an armed loser loses the fight', async () => {
    const loser = await registerAndLogin(app, 'insured_loser', 'StrongPass1!');
    const winner = await registerAndLogin(
      app,
      'insured_winner',
      'StrongPass1!',
    );
    await db
      .update(schema.users)
      .set({ aura: 1000 })
      .where(eq(schema.users.id, loser.userId));
    await db
      .update(schema.users)
      .set({ aura: 1000 })
      .where(eq(schema.users.id, winner.userId));
    await grant(loser.userId, 'fight_insurance', 1);
    await use(loser.token, { itemKey: 'fight_insurance' }).expect(201);

    await app
      .get(FightClubRepository)
      .settle(
        winner.userId,
        loser.userId,
        'aura',
        100,
        { player1Id: loser.userId, player2Id: winner.userId },
        'ko',
      );

    expect((await getUser(loser.userId)).aura).toBe(950);
    expect((await getUser(winner.userId)).aura).toBe(1050);
    expect((await getUser(loser.userId)).fightInsuranceArmed).toBe(false);
    const [fight] = await db
      .select({ insured: schema.fights.insured })
      .from(schema.fights)
      .where(eq(schema.fights.winnerId, winner.userId));
    expect(fight.insured).toBe(true);
  });

  it('exposes vineBoom on the profile only for owners of vine_boom', async () => {
    const owner = await registerAndLogin(app, 'boom_owner', 'StrongPass1!');
    const viewer = await registerAndLogin(app, 'boom_viewer', 'StrongPass1!');
    const getCosmetics = async () =>
      (
        (await request(app.getHttpServer())
          .get('/users/profile/boom_owner')
          .set('Authorization', `Bearer ${viewer.token}`)
          .expect(200)) as { body: { cosmetics: { vineBoom: boolean } } }
      ).body.cosmetics.vineBoom;

    expect(await getCosmetics()).toBe(false);
    await grant(owner.userId, 'vine_boom', 1);
    expect(await getCosmetics()).toBe(true);
  });

  it('reduces debt by 100 on forgiveness, letting it go negative', async () => {
    const debtor = await registerAndLogin(
      app,
      'forgiven_debtor',
      'StrongPass1!',
    );
    await db
      .update(schema.users)
      .set({ debt: 60 })
      .where(eq(schema.users.id, debtor.userId));
    await grant(debtor.userId, 'debt_forgiveness', 1);

    await use(debtor.token, { itemKey: 'debt_forgiveness' }).expect(201);

    expect((await getUser(debtor.userId)).debt).toBe(-40);
  });
});
