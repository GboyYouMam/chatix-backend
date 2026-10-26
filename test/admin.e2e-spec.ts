import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, makeAdmin, registerAndLogin } from './utils/test-app';
import type { Db } from '../src/database/database.types';

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
});
