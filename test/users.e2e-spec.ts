import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, registerAndLogin } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('Users security (e2e)', () => {
  let app: INestApplication;
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  let token: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    reset = () => testApp.reset();
    close = () => testApp.close();
  });
  beforeEach(async () => {
    await reset();
    ({ token } = await registerAndLogin(app, 'profile_user', 'Password123!'));
  });
  afterAll(async () => close?.());

  it('rejects mass assignment and preserves the user role', async () => {
    await request(app.getHttpServer())
      .post('/users/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((response.body as { role: string }).role).toBe('user');
  });

  it('rejects usernames that fail registration rules', async () => {
    await request(app.getHttpServer())
      .post('/users/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'a b' })
      .expect(400);
  });
});
