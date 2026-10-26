import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createRequire } from 'node:module';
import * as schema from '../../src/database/scheme';
import { configureApp } from '../../src/app.setup';
import { ConfigService } from '@nestjs/config';
import type { Db } from '../../src/database/database.types';

const loadModule = createRequire(__filename);
let testIpSequence = 1;

export async function createTestApp(): Promise<{
  app: INestApplication;
  db: ReturnType<typeof drizzle<typeof schema>>;
  reset(): Promise<void>;
  close(): Promise<void>;
}> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is required to run e2e tests');
  process.env.DATABASE_URL = url;
  process.env.TRUST_PROXY ??= '1';
  const connection = postgres(url);
  const db = drizzle(connection, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  const { AppModule } = loadModule('../../src/app.module') as {
    AppModule: typeof import('../../src/app.module').AppModule;
  };
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get(ConfigService));
  await app.init();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await connection.end();
    },
    reset: async () => {
      await connection`TRUNCATE admin_audit_logs, user_achievements, fights, user_warnings, message_attachments, messages, profile_comments, profile_respects, room_accesses, rooms, users CASCADE`;
    },
  };
}

export async function registerAndLogin(
  app: INestApplication,
  username: string,
  password: string,
) {
  const sequence = testIpSequence++ - 1;
  const testIp = `198.18.${Math.floor(sequence / 256)}.${sequence % 256}`;
  await request(app.getHttpServer())
    .post('/auth/register')
    .set('x-forwarded-for', testIp)
    .send({ username, password })
    .expect(201);
  const response = (await request(app.getHttpServer())
    .post('/auth/login')
    .set('x-forwarded-for', testIp)
    .send({ username, password })
    .expect(201)) as { body: { access_token: string } };
  const token = response.body.access_token;
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString(),
  ) as { sub: string };
  return {
    token,
    userId: payload.sub,
  };
}
export async function makeAdmin(db: Db, userId: string) {
  await db
    .update(schema.users)
    .set({ role: 'admin' })
    .where(eq(schema.users.id, userId));
}
export async function banUser(
  db: Db,
  userId: string,
  until: Date,
  reason: string,
) {
  await db
    .update(schema.users)
    .set({ bannedUntil: until, banReason: reason })
    .where(eq(schema.users.id, userId));
}
