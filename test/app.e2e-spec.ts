import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

const suite = process.env.DATABASE_URL_TEST ? describe : describe.skip;
suite('AppController (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    close = () => testApp.close();
  });
  afterAll(async () => {
    await close?.();
  });
  it('/ (GET)', () =>
    request(app.getHttpServer()).get('/').expect(200).expect('Hello World!'));
});
