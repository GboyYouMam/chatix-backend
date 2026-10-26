import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('room perks (e2e)', () => {
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

  const grant = (userId: string, itemKey: string) =>
    db.insert(schema.userInventory).values({ userId, itemKey, quantity: 1 });

  const createRoom = async (token: string, title: string, theme?: string) => {
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, publicity: 'public', ...(theme ? { theme } : {}) });
    return response;
  };

  const makeLive = (roomId: string) =>
    db
      .update(schema.rooms)
      .set({ status: 'active' })
      .where(eq(schema.rooms.id, roomId));

  it('puts a boosted room first in the lobby even when it is older', async () => {
    const owner = await registerAndLogin(app, 'boost_owner', 'StrongPass1!');
    const older = await createRoom(owner.token, 'boost older room');
    expect(older.status).toBe(201);
    const newer = await createRoom(owner.token, 'boost newer room');
    expect(newer.status).toBe(201);
    const olderId = (older.body as { id: string }).id;
    const newerId = (newer.body as { id: string }).id;
    await makeLive(olderId);
    await makeLive(newerId);
    await grant(owner.userId, 'room_boost');

    await request(app.getHttpServer())
      .post('/shop/use')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ itemKey: 'room_boost', roomId: olderId })
      .expect(201);

    const lobby = await request(app.getHttpServer()).get('/rooms').expect(200);
    const rooms = lobby.body as { id: string; boostedUntil: string | null }[];
    expect(rooms.map((room) => room.id)).toEqual([olderId, newerId]);
    expect(rooms[0].boostedUntil).not.toBeNull();
    expect(rooms[1].boostedUntil).toBeNull();
  });

  it('locks paid themes without ownership and fight club without the achievement', async () => {
    const owner = await registerAndLogin(app, 'theme_owner', 'StrongPass1!');

    const locked = await createRoom(
      owner.token,
      'theme locked room',
      'vaporwave',
    );
    expect(locked.status).toBe(403);
    expect(locked.body).toMatchObject({ code: 'THEME_LOCKED' });

    const basement = await createRoom(owner.token, 'basement room', 'basement');
    expect(basement.status).toBe(201);
    expect(basement.body).toMatchObject({ theme: 'basement' });

    await grant(owner.userId, 'theme_fight_club');
    const noAchievement = await createRoom(
      owner.token,
      'fight club room',
      'fight_club',
    );
    expect(noAchievement.status).toBe(403);
    expect(noAchievement.body).toMatchObject({ code: 'THEME_LOCKED' });

    await db.insert(schema.userAchievements).values({
      userId: owner.userId,
      key: 'found_the_basement',
    });
    const unlocked = await createRoom(
      owner.token,
      'fight club room ok',
      'fight_club',
    );
    expect(unlocked.status).toBe(201);
    expect(unlocked.body).toMatchObject({ theme: 'fight_club' });
  });

  it('writes an aura tax system line into the room history', async () => {
    const owner = await registerAndLogin(app, 'tax_payer', 'StrongPass1!');
    const created = await createRoom(owner.token, 'taxed room');
    expect(created.status).toBe(201);
    const roomId = (created.body as { id: string }).id;
    await makeLive(roomId);
    await grant(owner.userId, 'aura_tax');

    await request(app.getHttpServer())
      .post('/shop/use')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ itemKey: 'aura_tax', roomId })
      .expect(201);

    const history = await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=50`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const items = (
      history.body as { items: { kind: string; cipherText: string }[] }
    ).items;
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'system',
        cipherText: '@tax_payer paid the aura tax. bow.',
      }),
    ]);
    const room = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .expect(200);
    expect(room.body).toMatchObject({
      sponsoredBy: { username: 'tax_payer' },
    });
  });
});
