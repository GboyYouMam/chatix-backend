# BE-0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Спільна основа бекенду: валідований конфіг, правильна збірка модулів, структуровані логи з requestId, уніфіковані помилки, JWT з перевіркою по БД (роль, бан-локаут, token_version), спільна WS-автентифікація і realtime-сервіс, міграція схеми, e2e-інфраструктура.

**Architecture:** `ConfigModule` з `validate`, `DatabaseModule` в `AppModule`, `UsersRepository` у `UsersModule`. `nestjs-pino` як логер Nest. Глобальні фільтри HTTP/WS. `AuthUserValidator` — єдина точка перевірки payload для HTTP і WS. `RealtimeService` — реєстр namespace-серверів для емітів у `user:{id}` / `admins` і примусового відключення.

**Tech Stack:** NestJS 11, drizzle-orm, passport-jwt, socket.io, nestjs-pino, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-hardening-design.md` (§5, §7, §11, §12). Global Constraints: `docs/superpowers/plans/2026-10-26-chatix-hardening/00-overview.md`.

Гілка: `refactor/auth-logging-foundation` від `feat/hardening`. Робоча директорія — корінь бек-репо.

---

### Task 1: Конфіг і збірка модулів

**Files:**
- Create: `src/config/env.validation.ts`, `src/config/env.validation.spec.ts`
- Modify: `src/app.module.ts`, `src/admin/admin.module.ts`, `src/auth/auth.module.ts`, `src/users/users.module.ts`, `src/fight-club/fight-club.module.ts`, `.env.example`
- Move: `src/auth/users.repository.ts` → `src/users/users.repository.ts` (оновити всі імпорти)
- Modify: `src/auth/dto/request-user.dto.ts`; delete дублікати `RequestUser` у `src/messages/dto/create-message.dto.ts:13` і `src/rooms/room/dto/create-room.dto.ts:27`

**Interfaces:**
- Produces: `validateEnv(raw: Record<string, unknown>): EnvConfig`; `EnvConfig` з полями `PORT: number` (3000), `NODE_ENV: 'development'|'production'|'test'` ('development'), `DATABASE_URL`, `JWT_SECRET` (мін. 32 символи), `CORS_ORIGINS: string` (обов'язковий), `LOG_LEVEL: 'fatal'|'error'|'warn'|'info'|'debug'|'trace'` ('info'), `MINIO_ENDPOINT`, `MINIO_PORT: number`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_PUBLIC_URL`, `MINIO_USE_SSL: boolean` (false).
- Produces: `parseCorsOrigins(raw: string): string[]` (в тому ж файлі; split по `,`, trim, без порожніх).
- Produces: `RequestUser { userId: string; username: string; role: 'user' | 'admin' }` — єдиний, в `src/auth/dto/request-user.dto.ts`.
- Produces: `UsersModule` експортує `UsersRepository`; `AuthModule` імпортує `UsersModule`; `JwtModule` реєструється тільки в `AuthModule` з `global: true` на верхньому рівні опцій `registerAsync` (не всередині `useFactory`), `FightClubModule` власну реєстрацію видаляє.

- [ ] **Step 1: Тести** `env.validation.spec.ts`: `validateEnv` кидає, коли немає `JWT_SECRET`; кидає при `JWT_SECRET` коротшому за 32; повертає `MINIO_USE_SSL === false` і `LOG_LEVEL === 'info'` за замовчуванням; `MINIO_USE_SSL: 'true'` → `true`; `parseCorsOrigins(' http://a.com, ,http://b.com ')` → `['http://a.com','http://b.com']`.
- [ ] **Step 2:** `npx jest src/config` → FAIL (модуля немає).
- [ ] **Step 3:** Реалізувати через `plainToInstance` + `validateSync` (class-validator/class-transformer вже є). Підключити `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`, `DatabaseModule` в `AppModule.imports`, прибрати його з `AdminModule`. Перенести `UsersRepository`, звести `RequestUser`, виправити `JwtModule`. Додати нові змінні в `.env.example` (`CORS_ORIGINS=http://localhost:5173`, `LOG_LEVEL=info`, `NODE_ENV=development`, `MINIO_USE_SSL=false`).
- [ ] **Step 4:** `npx jest src/config` → PASS; `npm run build` → OK.
- [ ] **Step 5: Commit** `refactor(config): validate env and fix module wiring`.

### Task 2: Міграція схеми `0011_auth_hardening`

**Files:**
- Modify: `src/database/scheme.ts` (таблиця `users`)
- Create: `drizzle/0011_auth_hardening.sql` + оновлений `drizzle/meta/*` (через `npm run db:generate`, потім перейменувати файл/тег у `_journal.json` на `0011_auth_hardening`)

**Interfaces:**
- Produces колонки `users`: `tokenVersion: integer('token_version').default(0).notNull()`, `banReason: text('ban_reason')`, `autoBannedAt: timestamp('auto_banned_at')`; з `password` прибрано `.unique()`.

- [ ] **Step 1:** Змінити схему, `npm run db:generate`.
- [ ] **Step 2:** Перевірити SQL: лише `ADD COLUMN` ×3 і `DROP CONSTRAINT "users_password_unique"`; жодних змін інших таблиць (якщо drizzle тягне зайве — це розсинхрон зі snapshot 0010, виправити вручну і описати в коміті).
- [ ] **Step 3:** На локальній БД `npm run db:migrate` → без помилок.
- [ ] **Step 4: Commit** `feat(db): add token version, ban reason and autoban columns`.

### Task 3: Логи, requestId, фільтри помилок

**Files:**
- Create: `src/logging/logging.module.ts`, `src/common/errors/banned.exception.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/filters/http-exception.filter.spec.ts`, `src/common/filters/ws-exception.filter.ts`, `src/common/filters/ws-exception.filter.spec.ts`, `src/common/pipes/ws-validation.pipe.ts`
- Modify: `src/main.ts`, `src/app.module.ts`, `package.json`, усі файли з `console.log` / `new Logger()` без контексту (`src/messages/messages.gateway.ts:28` та ін. — `grep -rn "console\.\|new Logger()" src`)

**Interfaces:**
- Produces: `LoggingModule` (обгортка `LoggerModule.forRootAsync`): `pinoHttp.level = LOG_LEVEL`; `transport: pino-pretty` лише коли `NODE_ENV === 'development'`; `genReqId`: вхідний `x-request-id` (якщо це рядок ≤ 128 символів) або `randomUUID()`, і ставить його в заголовок відповіді `x-request-id`; `redact: ['req.headers.authorization','req.headers.cookie','*.password','*.token','*.handshake.auth']`; `autoLogging` вимкнено для `GET /` (health).
- Produces: `class BannedException extends ForbiddenException` — `constructor(bannedUntil: Date, banReason: string | null)`, response `{ code: 'BANNED', message: 'u banned, chud', bannedUntil: ISOString, banReason }`.
- Produces: `AllExceptionsFilter` (HTTP, `@Catch()`): тіло `{ statusCode, message, requestId, ...extraFields }`, де `extraFields` — додаткові поля з об'єктної відповіді `HttpException` (`code`, `bannedUntil`, `banReason`); `message` — рядок (масив повідомлень валідації — через `'; '`); невідомі помилки → 500 `'internal error. not ur fault (probably)'`; 5xx логуються `error` зі стеком, 4xx `warn` без стеку.
- Produces: `WsExceptionsFilter` (`@Catch()`, extends `BaseWsExceptionFilter`): емітить клієнту `exception` з `{ message, code? }`, логує `warn` з `socketId` і `userId` (з `client.data.user?.userId`).
- Produces: `wsValidationPipe` — інстанс `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: errs => new WsException(<повідомлення через '; '>) })`.

- [ ] **Step 1: Тести фільтрів.** `http-exception.filter.spec.ts`: `BannedException(new Date('2030-01-01'), 'lol')` → статус 403, тіло містить `code: 'BANNED'`, `bannedUntil: '2030-01-01T00:00:00.000Z'`, `banReason: 'lol'`, `requestId` з `req.id`; `BadRequestException(['a','b'])` → `message: 'a; b'`; `new Error('x')` → 500 і повідомлення не містить `'x'`. `ws-exception.filter.spec.ts`: `WsException('nope')` → `client.emit('exception', { message: 'nope' })`.
- [ ] **Step 2:** `npx jest src/common` → FAIL.
- [ ] **Step 3:** `npm i nestjs-pino pino-http` і `npm i -D pino-pretty`; реалізувати; у `main.ts`: `NestFactory.create(AppModule, { bufferLogs: true })`, `app.useLogger(app.get(Logger))`, `app.useGlobalFilters(new AllExceptionsFilter(...))`. Замінити `console.log` / безконтекстні логери на `new Logger(ClassName.name)`.
- [ ] **Step 4:** `npx jest src/common` → PASS; `npm run start:dev`, `curl -i localhost:3000/` → є заголовок `x-request-id`, у консолі pretty-лог запиту.
- [ ] **Step 5: Commit** `feat(logging): add pino logger, request ids and unified error filters` (за потреби розбити на `chore(deps): ...` + `feat(logging): ...`).

### Task 4: JWT з перевіркою по БД, бан-локаут, DTO авторизації

**Files:**
- Create: `src/auth/auth.constants.ts`, `src/auth/dto/register.dto.ts`, `src/auth/dto/login.dto.ts`, `src/auth/auth-user.validator.ts`, `src/auth/auth-user.validator.spec.ts`, `src/auth/jwt-payload.ts`
- Modify: `src/auth/jwt.strategy.ts`, `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.service.spec.ts`, `src/users/users.repository.ts`, `src/auth/auth.module.ts`

**Interfaces:**
- Produces: `USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,25}$/`, `PASSWORD_REGEX` (перенести з `auth.service.ts` як є) у `auth.constants.ts`.
- Produces: `JwtPayload { sub: string; username: string; role: 'user'|'admin'; tv: number }`.
- Produces: `UsersRepository.findAuthState(userId: string): Promise<AuthState | null>`, `AuthState { id; username; role; tokenVersion: number; bannedUntil: Date | null; banReason: string | null }`.
- Produces: `UsersRepository.bumpTokenVersion(userId: string, tx?: DbOrTx): Promise<void>` (атомарно `token_version + 1`). `DbOrTx` — тип drizzle-бази або транзакції; визначити в `src/database/database.types.ts` і експортувати.
- Produces: `AuthUserValidator.validate(payload: JwtPayload): Promise<RequestUser>` — `UnauthorizedException` якщо користувача немає або `(payload.tv ?? 0) !== tokenVersion`; `BannedException` якщо `bannedUntil > now`; роль і username — з БД.
- Produces: `AuthService.login(dto: LoginDto)` — після перевірки пароля, якщо активний бан → `BannedException`; payload з `tv`. `AuthService.register(dto: RegisterDto)`.
- Consumes: `BannedException` (Task 3).
- Логи `AuthService`: `auth.register` (`info`, `userId`), `auth.login.success` (`info`, `userId`), `auth.login.failed` (`warn`, `username`, `reason: 'no_user' | 'bad_password' | 'banned'`) — без пароля.

- [ ] **Step 1: Тести** `auth-user.validator.spec.ts` (репозиторій — мок): користувача немає → `UnauthorizedException`; `tv: 1` при `tokenVersion: 2` → `UnauthorizedException`; payload **без** `tv` при `tokenVersion: 0` → OK (Review Focus #1); `bannedUntil` = завтра → `BannedException` з `banReason`; `bannedUntil` = вчора → OK (Review Focus #3); роль у результаті — з БД (`payload.role: 'admin'`, БД `'user'` → `'user'`). У `auth.service.spec.ts` полагодити провайдери і додати: логін забаненого з правильним паролем → `BannedException`; неправильний пароль → `UnauthorizedException`; підписаний payload містить `tv`.
- [ ] **Step 2:** `npx jest src/auth` → FAIL.
- [ ] **Step 3:** Реалізувати; `JwtStrategy.validate` делегує в `AuthUserValidator`; контролер приймає DTO замість `any`.
- [ ] **Step 4:** `npx jest src/auth` → PASS.
- [ ] **Step 5: Commit** `feat(auth): validate jwt against db with token version and ban lockout`.

### Task 5: WS-автентифікація і RealtimeService

**Files:**
- Create: `src/auth/ws-auth.service.ts`, `src/auth/ws-auth.service.spec.ts`, `src/realtime/realtime.module.ts`, `src/realtime/realtime.service.ts`, `src/realtime/realtime.service.spec.ts`
- Modify: `src/messages/messages.gateway.ts`, `src/admin/admin.gateway.ts`, `src/admin/admin-activity-logger.service.ts`, `src/fight-club/fight-club.gateway.ts` (лише заміна власної перевірки JWT на `WsAuthService`), `src/app.module.ts`

**Interfaces:**
- Produces: `WsAuthService.authenticate(client: Socket): Promise<RequestUser>` — токен з `client.handshake.auth.token` (якщо починається з `'Bearer '` — зрізати), `jwtService.verifyAsync`, далі `AuthUserValidator.validate`; кладе `client.data.user`; при помилці кидає (виклик у `handleConnection` ловить, емітить `exception` з `{ message, code }` — для бану `code: 'BANNED'` + `bannedUntil`, `banReason` — і робить `client.disconnect(true)`; лог `ws.auth_failed` `warn`).
- Produces: `RealtimeService` (`@Global` модуль): `register(namespace: '/' | '/fight-club' | '/admin', server: Namespace | Server): void`; `emitToUser(userId: string, event: string, payload: unknown): void` (у `user:{id}` на `'/'`); `emitToAdmins(event: string, payload: unknown): void` (кімната `admins` на `/admin`); `emitToRoom(roomId: string, event: string, payload: unknown): void` (чат-кімната = `roomId` на `'/'`, як зараз у `messages.gateway.ts:32`); `disconnectUser(userId: string): void` — `in('user:'+id).disconnectSockets(true)` у **всіх** зареєстрованих namespace.
- Gateway-контракт: кожен gateway в `afterInit(server)` викликає `realtime.register(...)`; у `handleConnection` — `authenticate`, `client.join('user:' + userId)`, лог `ws.connect` (`userId`, `socketId`, `namespace`); `handleDisconnect` — лог `ws.disconnect`.
- `MessagesGateway`: видалити хендлер `sendMessage` і `console.log`; `joinRoom` лишається (перевірку доступу додає BE-1).
- `AdminGateway`: `@WebSocketGateway({ namespace: '/admin' })`, прибрати `@UseGuards` і `joinAdminLogs`; у `handleConnection` — не адмін → `exception` `{ message: 'admins only, chud' }` + disconnect; адмін → `join('admins')`. `AdminActivityLogger` емітить `newAdminLog` через `realtime.emitToAdmins`.
- Усі gateway: `@UseFilters(WsExceptionsFilter)`, `@UsePipes(wsValidationPipe)`.

- [ ] **Step 1: Тести.** `ws-auth.service.spec.ts`: без токена → reject; `'Bearer x'` і `'x'` → обидва передають `'x'` у `verifyAsync`; успіх → `client.data.user` встановлено. `realtime.service.spec.ts` (мок-сервери): `disconnectUser('u1')` викликає `in('user:u1').disconnectSockets(true)` на кожному зареєстрованому; `emitToAdmins` емітить лише в `/admin`.
- [ ] **Step 2:** `npx jest src/auth/ws-auth src/realtime` → FAIL.
- [ ] **Step 3:** Реалізувати і переключити gateway.
- [ ] **Step 4:** Тести PASS; ручна перевірка: `node -e` зі `socket.io-client` без токена до `/` → отримує `exception` і відключення.
- [ ] **Step 5: Commit** `feat(realtime): authenticate all gateways and add realtime service` (можна двома комітами: `feat(auth): add ws auth service`, `refactor(admin): move admin gateway to /admin namespace`).

### Task 6: Тести-заглушки і e2e-інфраструктура

**Files:**
- Modify/Delete: усі `*.spec.ts`, що містять лише `should be defined` і падають (`npx jest` покаже які) — полагодити провайдери моками або видалити, якщо тестують порожнечу
- Create: `test/utils/test-app.ts`, `test/auth.e2e-spec.ts`; Modify: `test/jest-e2e.json`, `test/app.e2e-spec.ts`, `package.json`, `README.md` (розділ про тести)

**Interfaces:**
- Produces: `createTestApp(): Promise<{ app: INestApplication; db: Db; reset(): Promise<void> }>` — бере `DATABASE_URL_TEST` (обов'язково, інакше кидає з поясненням), застосовує міграції drizzle (`migrate` з `drizzle-orm/postgres-js/migrator`), налаштовує ті ж pipe/filter, що `main.ts` (винести це в `src/app.setup.ts` → `configureApp(app: INestApplication): void`, використовується і в `main.ts`); `reset()` — `TRUNCATE ... CASCADE` усіх таблиць.
- Produces: helper `registerAndLogin(app, username, password): Promise<{ token: string; userId: string }>`, `makeAdmin(db, userId)`, `banUser(db, userId, until, reason)` у `test/utils/test-app.ts` — їх використовують BE-1/BE-3.

- [ ] **Step 1:** `test/auth.e2e-spec.ts`: register → 201; login → токен; `GET /users/me` з токеном → 200; забанити через `banUser` → `GET /users/me` → 403 з `code: 'BANNED'`; логін забаненого → 403 `BANNED`; змінити `token_version` в БД → `GET /users/me` → 401; відповідь має заголовок `x-request-id`.
- [ ] **Step 2:** `npm run test:e2e` → FAIL до реалізації інфраструктури.
- [ ] **Step 3:** Реалізувати; `test:e2e` з `--runInBand`.
- [ ] **Step 4:** `npx jest` (unit) і `npm run test:e2e` → PASS; `npm run lint` і `npm run build` → чисто.
- [ ] **Step 5: Commit** `test(e2e): add test app harness and auth e2e`, окремо `test: fix or drop broken placeholder specs`.
