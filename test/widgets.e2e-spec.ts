import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';
import * as schema from '../src/database/scheme';

interface ProfileWidgetsBody {
  widgets: {
    layout: string[];
    data: {
      nowPlaying: { provider: string; url: string; embedUrl: string } | null;
      status: { text: string; setAt: string | null } | null;
      rapSheet: { warns: unknown[]; bans: unknown[] };
      debt: number;
      hitCount: number;
    };
  };
}

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('widgets (e2e)', () => {
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

  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

  const getProfile = async (username: string, token: string) => {
    const response = await request(app.getHttpServer())
      .get(`/users/profile/${username}`)
      .set(authed(token))
      .expect(200);
    return response.body as ProfileWidgetsBody;
  };

  const patchLayout = (token: string, layout: unknown) =>
    request(app.getHttpServer())
      .patch('/users/me/widgets')
      .set(authed(token))
      .send({ layout });

  it('rejects unknown and duplicate widget keys with 400', async () => {
    const { token } = await registerAndLogin(app, 'layout_bad', 'StrongPass1!');

    await patchLayout(token, ['medal_rack', 'not_a_widget']).expect(400);
    await patchLayout(token, ['medal_rack', 'medal_rack']).expect(400);
  });

  it('locks hit_counter until the shop item is owned', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'layout_locked',
      'StrongPass1!',
    );

    const locked = await patchLayout(token, ['hit_counter']).expect(403);
    expect(locked.body).toMatchObject({ code: 'WIDGET_LOCKED' });

    await db.insert(schema.userInventory).values({
      userId,
      itemKey: 'hit_counter',
      quantity: 1,
    });
    await patchLayout(token, ['hit_counter']).expect(200);
  });

  it('forces rap_sheet on when the user has an active warning', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'rap_sheet_user',
      'StrongPass1!',
    );
    await patchLayout(token, ['medal_rack']).expect(200);
    await db
      .insert(schema.userWarnings)
      .values({ userId, reason: 'being mogged on purpose' });

    const body = await getProfile('rap_sheet_user', token);

    expect(body.widgets.layout).toEqual(['medal_rack', 'rap_sheet']);
    expect(body.widgets.data.rapSheet.warns).toHaveLength(1);
  });

  it('auto-shows wanted_poster when debt reaches 1000', async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'debtor_user',
      'StrongPass1!',
    );
    await patchLayout(token, ['medal_rack']).expect(200);
    await db
      .update(schema.users)
      .set({ debt: 1000 })
      .where(eq(schema.users.id, userId));

    const body = await getProfile('debtor_user', token);

    expect(body.widgets.layout).toContain('wanted_poster');
    expect(body.widgets.data.debt).toBe(1000);
  });

  it('counts a profile view once per viewer per day and skips the owner', async () => {
    const owner = await registerAndLogin(app, 'view_owner', 'StrongPass1!');
    const viewerA = await registerAndLogin(app, 'view_a', 'StrongPass1!');
    const viewerB = await registerAndLogin(app, 'view_b', 'StrongPass1!');

    await getProfile('view_owner', owner.token);
    const first = await getProfile('view_owner', viewerA.token);
    const repeat = await getProfile('view_owner', viewerA.token);
    const second = await getProfile('view_owner', viewerB.token);

    expect(first.widgets.data.hitCount).toBe(1);
    expect(repeat.widgets.data.hitCount).toBe(1);
    expect(second.widgets.data.hitCount).toBe(2);

    const [row] = await db
      .select({ views: schema.users.profileViews })
      .from(schema.users)
      .where(eq(schema.users.id, owner.userId));
    expect(row.views).toBe(2);
  });

  it('keeps a track link only for spotify and soundcloud and rejects spoofs', async () => {
    const { token } = await registerAndLogin(app, 'track_user', 'StrongPass1!');

    const spoof = await request(app.getHttpServer())
      .patch('/users/me/profile-extras')
      .set(authed(token))
      .send({ trackUrl: 'https://open.spotify.com.evil.com/track/x' })
      .expect(400);
    expect(JSON.stringify(spoof.body)).toContain(
      'spotify or soundcloud links only, chud.',
    );

    await request(app.getHttpServer())
      .patch('/users/me/profile-extras')
      .set(authed(token))
      .send({
        trackUrl:
          'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=1',
        statusText: '  vibing in the basement  ',
      })
      .expect(200);

    const body = await getProfile('track_user', token);
    expect(body.widgets.data.nowPlaying).toEqual({
      provider: 'spotify',
      url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      embedUrl:
        'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0',
    });
    expect(body.widgets.data.status).toMatchObject({
      text: 'vibing in the basement',
    });
  });

  it("records today's aura snapshot when aura is farmed", async () => {
    const { token, userId } = await registerAndLogin(
      app,
      'aura_snap',
      'StrongPass1!',
    );

    const farmed = (await request(app.getHttpServer())
      .post('/users/farm-aura')
      .set(authed(token))
      .expect(201)) as { body: { aura: number } };

    const rows = await db
      .select({ aura: schema.auraHistory.aura })
      .from(schema.auraHistory)
      .where(eq(schema.auraHistory.userId, userId));
    expect(rows).toEqual([{ aura: farmed.body.aura }]);
  });
});
