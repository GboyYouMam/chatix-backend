import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('admin detail endpoints (e2e)', () => {
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

  it('protects details and returns camelCase list and warning count', async () => {
    const { userId, token: userToken } = await registerAndLogin(
      app,
      'regular',
      'StrongPass1!',
    );
    const admin = await registerAndLogin(app, 'moderator', 'StrongPass1!');
    await makeAdmin(db, admin.userId);

    await request(app.getHttpServer())
      .get(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    const detail = await request(app.getHttpServer())
      .get(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(detail.body).toMatchObject({ activeWarningsCount: 0, pfpUrl: null });

    const list = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/"[^"]*_\w+"\s*:/);
  });

  it('autobans on the third active warning and keeps the ban after revocation', async () => {
    const target = await registerAndLogin(app, 'warn_target', 'StrongPass1!');
    const admin = await registerAndLogin(app, 'warn_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);

    let warningId = '';
    for (let i = 0; i < 3; i += 1) {
      const response = await request(app.getHttpServer())
        .post(`/admin/users/${target.userId}/warnings`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ reason: `warning ${i + 1}` })
        .expect(201);
      if (i === 2) {
        const body = response.body as {
          warning: { id: string };
          autoBanned: boolean;
          user: { activeWarningsCount: number };
        };
        warningId = body.warning.id;
        expect(body.autoBanned).toBe(true);
        expect(body.user.activeWarningsCount).toBe(3);
      }
    }

    const [banned] = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.id, target.userId),
      columns: { bannedUntil: true, tokenVersion: true },
    });
    expect(banned.bannedUntil).toBeInstanceOf(Date);
    expect(banned.tokenVersion).toBe(1);

    await request(app.getHttpServer())
      .delete(`/admin/users/${target.userId}/warnings/${warningId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const revokeAudit = await db.query.adminAuditLogs.findMany({
      where: (logs, { eq, and }) =>
        and(
          eq(logs.targetId, target.userId),
          eq(logs.actionKey, 'user.warn_revoke'),
        ),
    });
    expect(revokeAudit).toHaveLength(1);
    const [afterRevoke] = await db.query.users.findMany({
      where: (users, { eq }) => eq(users.id, target.userId),
      columns: { bannedUntil: true },
    });
    expect(afterRevoke.bannedUntil).toEqual(banned.bannedUntil);
  });

  it('filters dossier messages by room title and author username', async () => {
    const author = await registerAndLogin(app, 'filter_author', 'StrongPass1!');
    const other = await registerAndLogin(app, 'filter_other', 'StrongPass1!');
    const admin = await registerAndLogin(app, 'filter_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const [room] = await db
      .insert(schema.rooms)
      .values({ creatorId: admin.userId, title: 'Room Filter Target' })
      .returning({ id: schema.rooms.id });
    const [otherRoom] = await db
      .insert(schema.rooms)
      .values({ creatorId: admin.userId, title: 'Other Room' })
      .returning({ id: schema.rooms.id });
    await db.insert(schema.messages).values([
      { roomId: room.id, authorId: author.userId, cipherText: 'match one' },
      {
        roomId: otherRoom.id,
        authorId: author.userId,
        cipherText: 'match two',
      },
      { roomId: room.id, authorId: other.userId, cipherText: 'match three' },
    ]);
    const headers = { Authorization: `Bearer ${admin.token}` };
    const filtered = await request(app.getHttpServer())
      .get(
        '/admin/messages?room=FILTER TARGET&user=FILTER_AUTHOR&page=1&limit=10',
      )
      .set(headers)
      .expect(200);
    const items = (filtered.body as { items: Array<Record<string, unknown>> })
      .items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cipherText: 'match one',
      room: { id: room.id, title: 'Room Filter Target' },
      author: { username: 'filter_author' },
    });
  });

  it('clears ban metadata and applies atomic modifier deltas', async () => {
    const target = await registerAndLogin(
      app,
      'modifier_target',
      'StrongPass1!',
    );
    const admin = await registerAndLogin(app, 'modifier_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);

    const update = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(`/admin/users/${target.userId}/modifiers`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send(body);

    await update({ debtDelta: 100 }).expect(200);
    await update({ debtDelta: 100, auraDelta: -5000 }).expect(200);
    await update({
      bannedUntil: new Date(Date.now() + 86400000).toISOString(),
      banReason: 'manual',
    }).expect(200);
    const cleared = await update({ bannedUntil: null }).expect(200);
    expect(cleared.body).toMatchObject({ bannedUntil: null, banReason: null });

    const detail = await request(app.getHttpServer())
      .get(`/admin/users/${target.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(detail.body).toMatchObject({ debt: 200, aura: -4000 });
    await update({ aura: 5 }).expect(400);
  });

  it('never exposes private room password hashes to admins', async () => {
    const admin = await registerAndLogin(app, 'room_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const passwordHash = await bcrypt.hash('room-secret', 10);
    const [room] = await db
      .insert(schema.rooms)
      .values({
        creatorId: admin.userId,
        title: 'private-hash-check',
        publicity: 'private',
        password: passwordHash,
      })
      .returning({ id: schema.rooms.id });

    const headers = { Authorization: `Bearer ${admin.token}` };
    const list = await request(app.getHttpServer())
      .get('/admin/rooms')
      .set(headers)
      .expect(200);
    const roomsPage = list.body as {
      items: Array<{ id: string; password?: string }>;
    };
    const listedRoom = roomsPage.items.find(
      (item: { id: string }) => item.id === room.id,
    );
    expect(listedRoom).toBeDefined();
    expect(listedRoom).not.toHaveProperty('password');
    expect(JSON.stringify(listedRoom)).not.toContain(passwordHash);

    const detail = await request(app.getHttpServer())
      .get(`/admin/rooms/${room.id}`)
      .set(headers)
      .expect(200);
    expect(detail.body).not.toHaveProperty('password');
    expect(JSON.stringify(detail.body)).not.toContain(passwordHash);
  });
});
