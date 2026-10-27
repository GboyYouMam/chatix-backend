# chatix-backend

The server half of **Chatix**, a multi-user, imageboard-style chat with an edge, trolling attitude. Users talk in public and password-protected rooms. They farm and lose **aura**, and they fight each other in a hidden real-time **fight club** (a keyboard QTE duel). Aura buys cosmetics, troll items and room themes in the **laryok shop**, and the killsquad admins moderate everything from their own panel.

The frontend lives in a separate repo: [chatix-frontend](https://github.com/GboyYouMam/chatix-frontend).

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript 5 (Node.js 24) |
| Framework | NestJS 11 (Express platform) |
| Realtime | Socket.IO 4 through `@nestjs/websockets` |
| Database | PostgreSQL 15 + Drizzle ORM 0.45 (SQL migrations in `drizzle/`) |
| File storage | MinIO (S3-compatible object storage) |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt password hashes |
| Logging | `nestjs-pino` (structured JSON, request ids, secret redaction) |
| Tests | Jest 30 + Supertest + socket.io-client (unit and e2e) |

## Features

- **Auth.** Registration and login with strong password rules. Every request re-validates the JWT against the database through `tokenVersion`, so a ban or a logout everywhere takes effect immediately.
- **Rooms.**
  - Public and private rooms; private-room passwords are bcrypt-hashed.
  - Room names are unique case-insensitively.
  - New rooms start in moderation (`checkout`); after that a room can be `active`, `quarantined`, `banned` or `rejected`, each with a reason.
  - Seven room themes.
- **Messages.**
  - Real-time delivery over Socket.IO, with cursor pagination for history.
  - Up to 5 attachments per message, each checked by its real file signature, not by the declared MIME type.
  - Imageboard-style IP tags: the last block of the IP is replaced by a short HMAC, so it can never be read back.
- **Fight club.** A hidden lobby of 1v1 duels with an aura or debt stake.
  - The server runs the whole duel: it generates the prompts and checks reaction time, cooldowns and stuns.
  - It flags bot-like hit cadence and settles stakes in one transaction.
- **Economy.**
  - The aura balance can be farmed without limit; debt can go negative, which works as a "financial cushion".
  - Daily stimulus, plus a weekly leaderboard (weeks start Monday, UTC).
  - The **laryok shop** sells cosmetics, consumable troll items and themes. Every purchase is an atomic conditional update under a row lock.
- **Profiles.**
  - 13 widgets, including a Spotify/SoundCloud player, an aura chart, a guestbook and a hit counter.
  - Achievements are shown as SVG military medals.
- **Moderation.**
  - Warnings, with an automatic ban after three active ones; mutes ("yap cooldown"), clown mode and admin glaze mode.
  - An audit log of every admin action, and live admin updates over the `/admin` socket namespace.
- **Hardening.**
  - `helmet`, a CORS allowlist and global validation (`whitelist` + `forbidNonWhitelisted`).
  - Per-user rate limiting, with stricter limits on auth.
  - Proxy-aware client IPs and global HTTP/WS exception filters.

## Project layout

```
src/
  auth/          JWT strategy, guards, socket auth middleware
  users/         profiles, comments, respects
  rooms/room/    rooms, access, themes, moderation states
  messages/      REST + gateway, serializer, attachments
  fight-club/    lobby, duel engine, settlement
  shop/          catalog, purchases, cosmetics, consumables, effects
  economy/       stimulus, leaderboard
  widgets/       profile widgets, track URLs, aura history
  achievements/  catalog and granting
  admin/         admin API, audit interceptor, autoban, admin gateway
  realtime/      user rooms and broadcast helpers
  storage/       MinIO client and file policy
  common/        filters, guards, pipes, client IP, IP tags
  config/        environment validation
  database/      Drizzle schema and module
drizzle/         generated SQL migrations
test/            e2e suites (each runs against its own test database)
```

## Getting started

Requirements: Node.js 24+, Docker Desktop.

```bash
cp .env.example .env        # then set JWT_SECRET, IP_TAG_SECRET, MinIO password
docker compose up -d        # PostgreSQL on :5433, MinIO on :9000 (console :9001)
npm ci
npm run db:migrate          # apply all migrations
npm run start:dev           # API on http://localhost:3000
```

On Windows, `start-chatix.cmd` (one folder up) starts Docker, the database, the migrations, the backend and the frontend in one click.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | signing key for access tokens |
| `IP_TAG_SECRET` | HMAC key for masked IP tags (32+ chars) |
| `CORS_ORIGINS` | comma-separated list of allowed frontend origins |
| `MINIO_*` | object storage endpoint, credentials, bucket, public URL |
| `TRUST_PROXY`, `TRUSTED_IP_HEADER` | real client IP behind a proxy or CDN |
| `LOG_LEVEL`, `NODE_ENV` | logging verbosity and pretty output in development |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run start:dev` | dev server with watch mode |
| `npm run build` / `npm run start:prod` | production build and run (`node dist/main`) |
| `npm run db:generate` | generate a migration from schema changes |
| `npm run db:migrate` | apply migrations |
| `npm test` | unit tests |
| `npm run test:e2e` | end-to-end tests (needs `DATABASE_URL_TEST`) |
| `npm run lint` | ESLint |
