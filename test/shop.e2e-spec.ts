import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';
import { CosmeticsService } from '../src/shop/cosmetics.service';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('shop (e2e)', () => {
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

  const setAura = (userId: string, aura: number) =>
    db.update(schema.users).set({ aura }).where(eq(schema.users.id, userId));

  const getAura = async (userId: string) => {
    const [user] = await db
      .select({ aura: schema.users.aura })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return user.aura;
  };

  const purchase = (token: string, itemKey: string) =>
    request(app.getHttpServer())
      .post('/shop/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemKey });

  it('lets a user buy with exactly enough aura and leaves 0', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'exact_buyer',
      'StrongPass1!',
    );
    await setAura(userId, 300);

    const response = await purchase(token, 'title_certified_yapper').expect(
      201,
    );

    expect(response.body).toMatchObject({
      aura: 0,
      inventory: [{ itemKey: 'title_certified_yapper', quantity: 1 }],
    });
    expect(await getAura(userId)).toBe(0);
  });

  it('rejects a purchase 1 aura short with BROKE and no charge', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'broke_buyer',
      'StrongPass1!',
    );
    await setAura(userId, 299);

    const response = await purchase(token, 'title_certified_yapper').expect(
      400,
    );

    expect(response.body).toMatchObject({
      code: 'BROKE',
      message: 'u broke. go farm.',
    });
    expect(await getAura(userId)).toBe(299);
    expect(
      await db
        .select()
        .from(schema.userInventory)
        .where(eq(schema.userInventory.userId, userId)),
    ).toHaveLength(0);
  });

  it('charges once when the same permanent item is bought concurrently', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'double_clicker',
      'StrongPass1!',
    );
    // Exactly the nyan cat price: a double charge would surface as BROKE, not 409.
    await setAura(userId, 2500);

    const responses = await Promise.all([
      purchase(token, 'nyan_cat'),
      purchase(token, 'nyan_cat'),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body,
    ).toMatchObject({ code: 'ALREADY_OWNED' });
    expect(await getAura(userId)).toBe(0);
  });

  it('stacks consumables into quantity 2', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'consumer',
      'StrongPass1!',
    );
    await setAura(userId, 1000);

    await purchase(token, 'clown_stamp').expect(201);
    const second = (await purchase(token, 'clown_stamp').expect(201)) as {
      body: { inventory: unknown };
    };

    expect(second.body.inventory).toEqual([
      { itemKey: 'clown_stamp', quantity: 2 },
    ]);
    expect(await getAura(userId)).toBe(1000 - 120 * 2);
  });

  it('locks the fight club theme until the basement is found', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'no_basement',
      'StrongPass1!',
    );
    await setAura(userId, 5000);

    const locked = await purchase(token, 'theme_fight_club').expect(403);
    expect(locked.body).toMatchObject({ code: 'LOCKED' });
    expect(await getAura(userId)).toBe(5000);

    await db.insert(schema.userAchievements).values({
      userId,
      key: 'found_the_basement',
    });
    await purchase(token, 'theme_fight_club').expect(201);
  });

  const equip = (token: string, slot: string, itemKey: string | null) =>
    request(app.getHttpServer())
      .patch('/shop/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ slot, itemKey });

  it('refuses to equip an unowned item and a wrong-category item', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'equip_checker',
      'StrongPass1!',
    );
    await setAura(userId, 1000);

    const unowned = await equip(token, 'accent', 'accent_magenta').expect(403);
    expect(unowned.body).toMatchObject({ code: 'NOT_OWNED' });

    const wrongSlot = await equip(token, 'accent', 'bg_grid').expect(400);
    expect(wrongSlot.body).toMatchObject({ code: 'WRONG_SLOT' });
  });

  it('shows the equipped accent HEX on the profile and clears it on null', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'accent_wearer',
      'StrongPass1!',
    );
    await setAura(userId, 1000);
    await purchase(token, 'accent_magenta').expect(201);
    await equip(token, 'accent', 'accent_magenta').expect(200);

    const profile = await request(app.getHttpServer())
      .get('/users/profile/accent_wearer')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const profileBody = profile.body as { cosmetics: { accent: string } };
    expect(profileBody.cosmetics).toMatchObject({
      accent: '#e11d74',
      title: null,
    });

    await equip(token, 'accent', null).expect(200);
    const cleared = await request(app.getHttpServer())
      .get('/users/profile/accent_wearer')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (cleared.body as { cosmetics: { accent: string } }).cosmetics.accent,
    ).toBe('#fa4d98');
  });

  it('resolves author cosmetics on a message page with one cosmetics lookup', async () => {
    const owner = await registerAndLogin(app, 'glazer', 'StrongPass1!');
    const author = await registerAndLogin(app, 'namecolor_guy', 'StrongPass1!');
    await setAura(author.userId, 1000);
    await purchase(author.token, 'namecolor_rose').expect(201);
    await equip(author.token, 'nameColor', 'namecolor_rose').expect(200);

    const created = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'cosmetics room', publicity: 'public' })
      .expect(201);
    const roomId = (created.body as { id: string }).id;
    await db
      .update(schema.rooms)
      .set({ status: 'active' })
      .where(eq(schema.rooms.id, roomId));
    await db.insert(schema.messages).values([
      { roomId, authorId: author.userId, cipherText: 'a' },
      { roomId, authorId: owner.userId, cipherText: 'b' },
      { roomId, authorId: author.userId, cipherText: 'c' },
    ]);

    const cosmetics = app.get(CosmeticsService);
    const spy = jest.spyOn(cosmetics, 'forUsers');
    const page = await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=50`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    const items = (
      page.body as {
        items: { author: { id: string; cosmetics: unknown } }[];
      }
    ).items;
    const byAuthor = (id: string) =>
      items.find((item) => item.author.id === id)?.author.cosmetics;
    expect(byAuthor(author.userId)).toEqual({
      nameColor: '#fb7185',
      nameIcon: null,
      quoteStyle: null,
    });
    expect(byAuthor(owner.userId)).toEqual({
      nameColor: null,
      nameIcon: null,
      quoteStyle: null,
    });
  });
});
