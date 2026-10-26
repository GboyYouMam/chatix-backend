import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as schema from '../src/database/scheme';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('Rooms security (e2e)', () => {
  let app: INestApplication;
  let db: Awaited<ReturnType<typeof createTestApp>>['db'];
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  let token: string;
  let userId: string;
  let roomId: string;

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
      'room_owner',
      'Password123!',
    ));
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'private room', publicity: 'private', password: 'secret' })
      .expect(201);
    roomId = (created.body as { id: string }).id;
    await db
      .update(schema.rooms)
      .set({ status: 'active' })
      .where(eq(schema.rooms.id, roomId));
  });
  afterAll(async () => close?.());

  it('does not return the password from room endpoints', async () => {
    await request(app.getHttpServer())
      .get('/rooms?publicity=private')
      .expect(401);
    const rooms = await request(app.getHttpServer())
      .get('/rooms?publicity=private')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const roomList = rooms.body as {
      hasPassword: boolean;
      password?: string;
    }[];
    const detail = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .expect(200);
    const named = await request(app.getHttpServer())
      .get('/rooms/by-name/private%20room')
      .expect(200);
    const namedCaseInsensitive = await request(app.getHttpServer())
      .get('/rooms/by-name/PRIVATE%20ROOM')
      .expect(200);
    const detailBody = detail.body as {
      hasPassword: boolean;
      password?: string;
    };
    expect(detailBody).not.toHaveProperty('password');
    expect(detailBody.hasPassword).toBe(true);
    expect(named.body).not.toHaveProperty('password');
    expect((namedCaseInsensitive.body as { id: string }).id).toBe(roomId);
    expect(roomList[0]).not.toHaveProperty('password');
    expect(roomList[0].hasPassword).toBe(true);
  });

  it('hashes room passwords and checks them when a new user joins', async () => {
    const room = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
    });
    expect(room?.password).not.toBe('secret');
    if (!room?.password) throw new Error('room password was not saved');
    await expect(bcrypt.compare('secret', room.password)).resolves.toBe(true);

    const guest = await registerAndLogin(app, 'room_guest', 'Password123!');
    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guest.token}`)
      .send({ password: 'wrong' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guest.token}`)
      .send({ password: 'secret' })
      .expect(201);
  });

  it('rejects invalid room status values', async () => {
    await makeAdmin(db, userId);
    const response = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'lol' });
    expect(response.status).toBe(400);

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/publicity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publicity: 'private' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/publicity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publicity: 'private', password: '123' })
      .expect(400);
  });

  it('rejects case-insensitive duplicate titles on create and rename', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Chud', publicity: 'public' })
      .expect(201);
    const duplicate = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'chud', publicity: 'public' })
      .expect(409);
    expect(duplicate.body).toMatchObject({ code: 'ROOM_NAME_TAKEN' });
    const rename = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'CHUD', publicity: 'private' })
      .expect(409);
    expect(rename.body).toMatchObject({ code: 'ROOM_NAME_TAKEN' });
  });

  it('shows status reasons only to the creator and lets admins restore banned rooms', async () => {
    await db
      .update(schema.rooms)
      .set({ status: 'quarantined', statusReason: 'too cooked' })
      .where(eq(schema.rooms.id, roomId));
    const ownRoom = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((ownRoom.body as { statusReason: string }).statusReason).toBe(
      'too cooked',
    );
    const guest = await registerAndLogin(
      app,
      'room_guest_status',
      'Password123!',
    );
    const publicRoom = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${guest.token}`)
      .expect(200);
    expect(publicRoom.body).not.toHaveProperty('statusReason');

    await makeAdmin(db, userId);
    await db
      .update(schema.rooms)
      .set({ status: 'banned' })
      .where(eq(schema.rooms.id, roomId));
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
      .expect(200);
  });

  it('validates the publicity query', async () => {
    await request(app.getHttpServer()).get('/rooms?publicity=lol').expect(400);
  });

  it('lists the creator’s rooms in every status', async () => {
    const checkout = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'still in review', publicity: 'public' })
      .expect(201);
    const mine = await request(app.getHttpServer())
      .get('/rooms/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mine.body).toContainEqual(
      expect.objectContaining({
        id: (checkout.body as { id: string }).id,
        status: 'checkout',
      }),
    );
  });
});
