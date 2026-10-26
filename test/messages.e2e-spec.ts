import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import * as schema from '../src/database/scheme';
import { MessagesRepository } from '../src/messages/messages.repository';
import { createTestApp, registerAndLogin } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('Messages security and pagination (e2e)', () => {
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
      'messages_owner',
      'Password123!',
    ));
    const created = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'message room', publicity: 'public' })
      .expect(201);
    roomId = (created.body as { id: string }).id;
    await db
      .update(schema.rooms)
      .set({ status: 'active' })
      .where(eq(schema.rooms.id, roomId));
  });
  afterAll(async () => close?.());

  it('pages history without overlap and blocks unauthorized private access', async () => {
    await db.insert(schema.messages).values(
      Array.from({ length: 120 }, (_, index) => ({
        roomId,
        authorId: userId,
        cipherText: `message-${index}`,
        createdAt: new Date(Date.now() + index),
      })),
    );

    const first = await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=50`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const firstPage = first.body as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.nextCursor).toBe(firstPage.items[0].id);

    const second = await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=50&before=${firstPage.nextCursor}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const secondPage = second.body as { items: { id: string }[] };
    expect(secondPage.items).toHaveLength(50);
    expect(
      secondPage.items.some(({ id }) =>
        firstPage.items.some((firstItem) => firstItem.id === id),
      ),
    ).toBe(false);

    const third = await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=50&before=${secondPage.items[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const thirdPage = third.body as { items: { id: string }[] };
    expect(thirdPage.items).toHaveLength(20);
    expect(
      new Set([
        ...firstPage.items.map(({ id }) => id),
        ...secondPage.items.map(({ id }) => id),
        ...thirdPage.items.map(({ id }) => id),
      ]).size,
    ).toBe(120);

    await request(app.getHttpServer())
      .get(`/messages/${roomId}?limit=101`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    const privateRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'locked room', publicity: 'private', password: 'secret' })
      .expect(201);
    const privateRoomId = (privateRoom.body as { id: string }).id;
    const guest = await registerAndLogin(app, 'messages_guest', 'Password123!');
    await request(app.getHttpServer())
      .get(`/messages/${privateRoomId}`)
      .set('Authorization', `Bearer ${guest.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${guest.token}`)
      .send({ roomId: privateRoomId, cipherText: 'intrusion' })
      .expect(403);
  });

  it('rolls back a message when its attachment row cannot be inserted', async () => {
    const before = await db.query.messages.findMany({
      where: eq(schema.messages.roomId, roomId),
    });
    await expect(
      app
        .get(MessagesRepository)
        .create(roomId, userId, 'atomic write', undefined, [
          {
            url: 'https://storage.test/attachment.pdf',
            fileName: 'x'.repeat(256),
            mimeType: 'application/pdf',
            size: 1,
          },
        ]),
    ).rejects.toThrow();
    const after = await db.query.messages.findMany({
      where: eq(schema.messages.roomId, roomId),
    });
    expect(after).toHaveLength(before.length);
  });
});
