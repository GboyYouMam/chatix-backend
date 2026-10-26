import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';
import { eq } from 'drizzle-orm';
import { RealtimeService } from '../src/realtime/realtime.service';

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

  it('persists human-readable audit targets and mutation diffs', async () => {
    const target = await registerAndLogin(app, 'audit_target', 'StrongPass1!');
    const admin = await registerAndLogin(app, 'audit_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const headers = { Authorization: `Bearer ${admin.token}` };

    await request(app.getHttpServer())
      .get('/admin/users')
      .set(headers)
      .expect(200);
    expect(await db.query.adminAuditLogs.findMany()).toHaveLength(0);

    const bannedUntil = new Date(Date.now() + 60_000).toISOString();
    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/modifiers`)
      .set(headers)
      .send({ bannedUntil, banReason: 'ur cooked' })
      .expect(200);
    const [banLog] = await db.query.adminAuditLogs.findMany({
      where: (logs, { eq }) => eq(logs.actionKey, 'user.ban'),
    });
    expect(banLog).toMatchObject({
      targetLabel: 'audit_target',
      details: {
        reason: 'ur cooked',
        before: { bannedUntil: null },
        after: { bannedUntil: new Date(bannedUntil).toISOString() },
      },
    });

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/modifiers`)
      .set(headers)
      .send({ auraDelta: -50 })
      .expect(200);
    const [auraLog] = await db.query.adminAuditLogs.findMany({
      where: (logs, { eq }) => eq(logs.actionKey, 'user.modifiers'),
    });
    expect(auraLog.details).toMatchObject({
      before: { aura: 1000 },
      after: { aura: 950 },
    });
  });

  it('filters audit logs by contract fields and joins the admin', async () => {
    const admin = await registerAndLogin(
      app,
      'audit_filter_admin',
      'StrongPass1!',
    );
    const target = await registerAndLogin(
      app,
      'audit_filter_target',
      'StrongPass1!',
    );
    await makeAdmin(db, admin.userId);
    const createdAt = new Date('2026-10-20T12:00:00.000Z');
    await db.insert(schema.adminAuditLogs).values([
      {
        adminId: admin.userId,
        action: 'user.warn',
        actionKey: 'user.warn',
        method: 'POST',
        path: '/admin/users/x/warnings',
        targetType: 'user',
        targetId: target.userId,
        targetLabel: 'audit_filter_target',
        statusCode: 201,
        success: true,
        durationMs: 4,
        createdAt,
      },
      {
        adminId: admin.userId,
        action: 'user.ban',
        actionKey: 'user.ban',
        method: 'PATCH',
        path: '/admin/users/x/modifiers',
        targetType: 'user',
        targetId: target.userId,
        statusCode: 200,
        success: false,
        durationMs: 3,
        createdAt: new Date('2026-10-19T12:00:00.000Z'),
      },
    ]);
    const result = await request(app.getHttpServer())
      .get(
        `/admin/audit-logs?adminId=${admin.userId}&actionKey=user.warn&targetType=user&targetId=${target.userId}&success=true&from=2026-10-20T00:00:00.000Z&to=2026-10-21T00:00:00.000Z`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const auditItems = (
      result.body as { items: Array<Record<string, unknown>> }
    ).items;
    expect(auditItems).toHaveLength(1);
    expect(auditItems[0]).toMatchObject({
      actionKey: 'user.warn',
      targetId: target.userId,
      admin: { id: admin.userId, username: 'audit_filter_admin' },
    });
    const failed = await request(app.getHttpServer())
      .get(
        `/admin/audit-logs?targetType=user&targetId=${target.userId}&success=false`,
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect((failed.body as { items: unknown[] }).items).toHaveLength(1);
  });

  it('returns dashboard counts and supports room approval and rejection', async () => {
    const creator = await registerAndLogin(
      app,
      'queue_creator',
      'StrongPass1!',
    );
    const admin = await registerAndLogin(app, 'queue_admin', 'StrongPass1!');
    const banned = await registerAndLogin(app, 'queue_banned', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const [pending] = await db
      .insert(schema.rooms)
      .values({ creatorId: creator.userId, title: 'queue pending' })
      .returning({ id: schema.rooms.id });
    const [rejectMe] = await db
      .insert(schema.rooms)
      .values({ creatorId: creator.userId, title: 'queue reject' })
      .returning({ id: schema.rooms.id });
    await db
      .update(schema.users)
      .set({
        bannedUntil: new Date(Date.now() + 60_000),
        autoBannedAt: new Date(),
      })
      .where(eq(schema.users.id, banned.userId));
    await db.insert(schema.userWarnings).values({
      userId: banned.userId,
      adminId: admin.userId,
      reason: 'test warning',
    });
    const headers = { Authorization: `Bearer ${admin.token}` };
    const realtime = app.get(RealtimeService);
    const emitToAdmins = jest.spyOn(realtime, 'emitToAdmins');
    const emitToUser = jest.spyOn(realtime, 'emitToUser');
    const stats = await request(app.getHttpServer())
      .get('/admin/stats')
      .set(headers)
      .expect(200);
    expect((stats.body as { roomsInReview: number }).roomsInReview).toBe(2);
    expect(stats.body).toMatchObject({
      activeBans: 1,
      warnsToday: 1,
      autobansThisWeek: 1,
    });
    const queue = await request(app.getHttpServer())
      .get('/admin/rooms?status=checkout')
      .set(headers)
      .expect(200);
    expect((queue.body as { items: unknown[] }).items).toHaveLength(2);
    await request(app.getHttpServer())
      .patch(`/admin/rooms/${pending.id}/approve`)
      .set(headers)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/rooms/${rejectMe.id}/reject`)
      .set(headers)
      .send({ reason: 'too cooked' })
      .expect(200);
    expect(emitToAdmins).toHaveBeenCalledWith(
      'admin:room_updated',
      expect.anything(),
    );
    expect(emitToUser).toHaveBeenCalledWith(
      creator.userId,
      'room:status',
      expect.anything(),
    );
    const mine = await request(app.getHttpServer())
      .get('/rooms/mine')
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);
    expect(mine.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pending.id, status: 'active' }),
        expect.objectContaining({
          id: rejectMe.id,
          status: 'rejected',
          statusReason: 'too cooked',
        }),
      ]),
    );
    await request(app.getHttpServer())
      .patch(`/admin/rooms/${pending.id}/approve`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(403);
  });

  it('returns distinct user IP history and paged admin messages', async () => {
    const target = await registerAndLogin(
      app,
      'dossier_target',
      'StrongPass1!',
    );
    const admin = await registerAndLogin(app, 'dossier_admin', 'StrongPass1!');
    await makeAdmin(db, admin.userId);
    const [room] = await db
      .insert(schema.rooms)
      .values({ creatorId: admin.userId, title: 'dossier room' })
      .returning({ id: schema.rooms.id });
    const messagesSeeded = await db
      .insert(schema.messages)
      .values([
        {
          roomId: room.id,
          authorId: target.userId,
          cipherText: 'first dossier message',
          ipAddress: '203.0.113.10',
          createdAt: new Date(Date.now() - 10_000),
        },
        {
          roomId: room.id,
          authorId: target.userId,
          cipherText: 'second dossier message',
          ipAddress: '203.0.113.10',
          createdAt: new Date(Date.now() - 5_000),
        },
        {
          roomId: room.id,
          authorId: target.userId,
          cipherText: 'third dossier message',
          ipAddress: '203.0.113.11',
          createdAt: new Date(),
        },
      ])
      .returning({ id: schema.messages.id });
    await db.insert(schema.messageAttachments).values({
      messageId: messagesSeeded[2].id,
      url: 'https://files.example.test/dossier.png',
      fileName: 'dossier.png',
      mimeType: 'image/png',
      size: 100,
    });
    const headers = { Authorization: `Bearer ${admin.token}` };
    const ips = await request(app.getHttpServer())
      .get(`/admin/users/${target.userId}/ips`)
      .set(headers)
      .expect(200);
    const ipItems = ips.body as Array<{ ip: string; messages: number }>;
    expect(ipItems).toHaveLength(2);
    expect(ipItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ip: '203.0.113.10', messages: 2 }),
        expect.objectContaining({ ip: '203.0.113.11', messages: 1 }),
      ]),
    );
    const messages = await request(app.getHttpServer())
      .get(`/admin/users/${target.userId}/messages?page=1&limit=2`)
      .set(headers)
      .expect(200);
    const dossierItems = (
      messages.body as { items: Array<Record<string, unknown>> }
    ).items;
    expect(dossierItems).toHaveLength(2);
    expect(dossierItems[0]).toMatchObject({
      author: { username: 'dossier_target' },
      room: { id: room.id, title: 'dossier room' },
    });
    expect(typeof dossierItems[0].ipAddress).toBe('string');
    expect(dossierItems[0].attachments).toMatchObject([
      { fileName: 'dossier.png' },
    ]);
    await request(app.getHttpServer())
      .get(`/admin/users/${target.userId}/ips`)
      .set('Authorization', `Bearer ${target.token}`)
      .expect(403);
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
