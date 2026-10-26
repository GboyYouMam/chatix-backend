# BE-1 Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити mass assignment у профілі, небезпечні завантаження, відкритий CORS і відсутність rate limit, plaintext-паролі кімнат і їх витік через API, доступ до приватних кімнат через повідомлення; додати пагінацію і транзакції повідомлень.

**Architecture:** Політики файлів — окремий чистий модуль поверх `file-type`; серіалізатор кімнат прибирає `password`; `RoomService.assertCanAccess` — єдина перевірка доступу для HTTP і WS; throttler глобально + точкові ліміти.

**Tech Stack:** NestJS 11, drizzle-orm, bcrypt, file-type@16.5.4, @nestjs/throttler, helmet, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-hardening-design.md` (§5 MessagesGateway, §6, §11). Global Constraints: `docs/superpowers/plans/2026-10-26-chatix-hardening/00-overview.md`.

Гілка: `fix/security-hardening` від `feat/hardening` (після злиття BE-0).

**Consumes з BE-0:** `RequestUser`, `USERNAME_REGEX` (`src/auth/auth.constants.ts`), `DbOrTx` (`src/database/database.types.ts`), `parseCorsOrigins` (`src/config/env.validation.ts`), `configureApp(app)` (`src/app.setup.ts`), `createTestApp`, `registerAndLogin`, `makeAdmin` (`test/utils/test-app.ts`), `wsValidationPipe`, `WsExceptionsFilter`.

---

### Task 1: Профіль без mass assignment

**Files:**
- Modify: `src/users/dto/update-profile.dto.ts`, `src/users/users.controller.ts:64-90`, `src/users/users.service.ts` (`updateProfile`)
- Test: `src/users/users.service.spec.ts`, `test/users.e2e-spec.ts`

**Interfaces:**
- Produces: `UsersService.updateProfile(userId: string, dto: UpdateProfileDto, files: ProfileFiles): Promise<PublicUser>` — у БД пишуться лише явно перелічені поля DTO + URL файлів; якщо `canChangeProfile === false` → `ForbiddenException('ur profile is frozen by the admins. cope.')`.
- `UpdateProfileDto.username`: `@Matches(USERNAME_REGEX)`; решта полів — з обмеженнями довжини (`description` ≤ 500, `vibe` ≤ 50).

- [ ] **Step 1: Тести.** Unit: `canChangeProfile: false` → `ForbiddenException`; репозиторій отримує об'єкт тільки з ключами DTO (перевірити `toHaveBeenCalledWith` без `role`/`aura`). E2E: `POST /users/update` з `{ role: 'admin' }` → 400, а `GET /users/me` далі має `role: 'user'`; `username: 'a b'` → 400.
- [ ] **Step 2:** Запустити → FAIL.
- [ ] **Step 3:** Прибрати `{...body}` і `as any` (у т.ч. в `auraFarming`), реалізувати.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(users): block mass assignment and enforce profile freeze`.

### Task 2: Безпечні завантаження

**Files:**
- Create: `src/storage/file-policy.ts`, `src/storage/file-policy.spec.ts`
- Modify: `src/storage/storage.service.ts`, `src/users/users.controller.ts` (multer limits), `src/messages/messages.controller.ts` (multer limits), `src/messages/messages.service.ts`, `package.json`

**Interfaces:**
- Produces: `interface FilePolicy { allowed: ReadonlyArray<{ ext: string; mime: string }>; maxBytes: number; maxFiles: number }`; `PROFILE_IMAGE_POLICY` (`png`,`jpg`→`image/jpeg`,`webp`,`gif`; 5 МБ; 1 на поле); `MESSAGE_ATTACHMENT_POLICY` (ті ж картинки + `pdf`, `txt`, `zip`, `mp4`, `webm`, `mp3`; 10 МБ; 5).
- Produces: `detectFile(buffer: Buffer, declaredMime: string): Promise<{ ext: string; mime: string } | null>` — `fromBuffer` з `file-type`; якщо не визначено і `declaredMime === 'text/plain'` і буфер — валідний UTF-8 без байта `0x00` → `{ ext: 'txt', mime: 'text/plain' }`; інакше `null`.
- Produces: `assertAllowed(file: Express.Multer.File, policy: FilePolicy): Promise<{ ext: string; mime: string }>` — `BadRequestException('file type not allowed. nice try.')` / `('file too big, chud')`; лог `upload.rejected` (`warn`, `reason`, `size`, `declaredMime`, без вмісту).
- Produces: `StorageService.upload(file: Express.Multer.File, detected: { ext: string; mime: string }, folder: 'profiles' | 'attachments'): Promise<string>` — ключ `${folder}/${randomUUID()}.${ext}`, `Content-Type: detected.mime`, для mime не з `image/`, `video/`, `audio/` — `Content-Disposition: attachment`; `useSSL` з `MINIO_USE_SSL`.

- [ ] **Step 1: Тести** `file-policy.spec.ts` на реальних байтах (сигнатури як фікстури в тесті): PNG-байти з `originalname: 'x.html'` → `{ ext: 'png' }` (Review Focus #4); `'<svg xmlns=...'` з `mimetype: 'image/png'` → reject; `'<html>'` з `text/plain`… → дозволено лише як `txt` для повідомлень і reject для профілю; PDF у `PROFILE_IMAGE_POLICY` → reject; розмір `5*1024*1024 + 1` для профілю → reject; текст з `0x00` → `null`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npm i file-type@16.5.4`; реалізувати; multer `limits.fileSize` = `maxBytes` політики; викликати `assertAllowed` до `upload`.
- [ ] **Step 4:** PASS; вручну завантажити аватар PNG і вкладення PDF — працює.
- [ ] **Step 5: Commit** `fix(storage): validate uploads by content and serve safe headers`.

### Task 3: CORS, helmet, rate limit

**Files:**
- Create: `src/common/adapters/configured-io.adapter.ts`, `src/common/guards/user-throttler.guard.ts`
- Modify: `src/app.setup.ts`, `src/app.module.ts`, `src/auth/auth.controller.ts`, `src/rooms/room/room.controller.ts` (`POST :id/join`), `src/users/users.controller.ts` (`farm-aura`), `src/messages/messages.controller.ts` (`POST /messages`), `package.json`
- Test: `test/security.e2e-spec.ts`

**Interfaces:**
- Produces: `ConfiguredIoAdapter extends IoAdapter` — `createIOServer(port, options)` підставляє `cors: { origin: parseCorsOrigins(CORS_ORIGINS), credentials: true }` для всіх namespace (прибрати `cors: { origin: '*' }` з декораторів gateway).
- `configureApp`: `app.use(helmet())`, `app.enableCors({ origin: parseCorsOrigins(...), credentials: true })`, `app.useWebSocketAdapter(new ConfiguredIoAdapter(app))`.
- Throttler: `ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }])` + `APP_GUARD: ThrottlerGuard`; `@Throttle({ default: { limit: 5, ttl: 60_000 } })` на `POST /auth/login`, `POST /auth/register`, `POST /rooms/:id/join`; `@SkipThrottle()` на `POST /users/farm-aura`.
- Produces: `UserThrottlerGuard extends ThrottlerGuard` — `getTracker(req)` повертає `req.user?.userId ?? req.ip`; на `POST /messages`: `@SkipThrottle()` для глобального + `@UseGuards(JwtAuthGuard, UserThrottlerGuard)` + `@Throttle({ default: { limit: 20, ttl: 60_000 } })`.
- 429 проходить через `AllExceptionsFilter` з `message: 'chill. too many requests.'`.

- [ ] **Step 1: E2E тести:** 6-й `POST /auth/login` за хвилину → 429; 30 запитів `POST /users/farm-aura` → жодного 429; preflight з `Origin: http://evil.com` → без `access-control-allow-origin`; з дозволеного origin → є; є заголовок `x-content-type-options` (helmet).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npm i @nestjs/throttler helmet`; реалізувати. Для e2e — `CORS_ORIGINS=http://localhost:5173` у тестовому env.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(security): restrict cors and add helmet and rate limiting`.

### Task 4: Паролі кімнат і серіалізація кімнат

**Files:**
- Create: `src/rooms/room/room.serializer.ts`, `src/rooms/room/room.serializer.spec.ts`, `src/rooms/room/dto/update-room-status.dto.ts`, `src/rooms/room/dto/update-room-publicity.dto.ts`, `scripts/hash-room-passwords.ts`
- Modify: `src/rooms/room/room.service.ts` (create/update/`joinPrivateRoom`:74-90), `src/rooms/room/room.controller.ts`, `src/rooms/room/rooms.repository.ts`, `package.json` (скрипт `db:hash-room-passwords`: `ts-node -r tsconfig-paths/register scripts/hash-room-passwords.ts`)
- Test: `src/rooms/room/room.service.spec.ts`, `test/rooms.e2e-spec.ts`

**Interfaces:**
- Produces: `toPublicRoom<T extends { password?: string | null }>(room: T): Omit<T, 'password'> & { hasPassword: boolean }` — використовується в **усіх** відповідях з кімнатами (і BE-3 використає в адмінці).
- Паролі: `bcrypt.hash(pw, 10)` при create/update; `joinPrivateRoom` — `bcrypt.compare`; повідомлення про помилку лишається `'Wrong password. Get lost lmao.'`.
- Скрипт: хешує всі `rooms.password`, що не `null` і не починаються з `'$2'`; ідемпотентний; друкує кількість оновлених.
- DTO: `UpdateRoomStatusDto { @IsEnum(<enum статусів зі схеми>) status }`, `UpdateRoomPublicityDto { @IsEnum(...) publicity; @ValidateIf(private) @IsString() @MinLength(4) password? }` — точні значення enum взяти з `src/database/scheme.ts`.

- [ ] **Step 1: Тести.** `toPublicRoom({ id: '1', password: 'x' })` → `{ id: '1', hasPassword: true }` без ключа `password`. Service: створення зберігає хеш (≠ вхідному, `bcrypt.compare` true); join з правильним паролем → OK, з неправильним → `ForbiddenException`. E2E: `GET /rooms`, `GET /rooms/:id`, `GET /rooms/by-name/:name` — у тілі немає `password`; `PATCH /rooms/:id/status` з `status: 'lol'` → 400.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** PASS; запустити скрипт двічі на локальній БД — вдруге «0 updated».
- [ ] **Step 5: Commit** `fix(rooms): hash room passwords and stop leaking them` + `feat(rooms): validate status and publicity with dtos`.

### Task 5: Доступ до приватних кімнат, пагінація, транзакції повідомлень

**Files:**
- Modify: `src/rooms/room/room.service.ts`, `src/messages/messages.controller.ts`, `src/messages/messages.service.ts`, `src/messages/messages.repository.ts` (`:148-165`, `:183`), `src/messages/messages.gateway.ts` (`joinRoom`)
- Create: `src/messages/dto/get-messages.query.dto.ts`, `src/messages/dto/join-room.dto.ts`
- Test: `src/messages/messages.service.spec.ts`, `test/messages.e2e-spec.ts`

**Interfaces:**
- Produces: `RoomService.assertCanAccess(roomId: string, userId: string): Promise<void>` — кімнати немає → `NotFoundException`; приватна і немає запису в `roomAccesses` для користувача і він не творець → `ForbiddenException('private room. know the password or leave.')`. Карантин доступ **не** блокує (read-only лишається як зараз).
- Produces: `GET /messages/:roomId?before=<messageId>&limit=<1..100, default 50>` → `{ items: Message[]; nextCursor: string | null }`; `items` у хронологічному порядку (старі → нові); сторінка = найновіші `limit` повідомлень, старіші за `before`; порядок `createdAt DESC, id DESC` для стабільності при однаковому `createdAt`; `nextCursor` = id найстарішого в сторінці, або `null`, якщо старіших немає.
- `POST /messages` і `GET /messages/:roomId` викликають `assertCanAccess`; `joinRoom` (DTO `{ roomId: uuid }`) — теж; при відмові WS `exception` і без `join`.
- Транзакції: вставка повідомлення + вкладень — одна `db.transaction`; видалення вкладень + оновлення повідомлення — одна транзакція; при помилці завантажені в MinIO об'єкти видаляються (best effort, лог `warn`).

- [ ] **Step 1: Тести.** Unit: `assertCanAccess` для трьох випадків (публічна, приватна з доступом, приватна без). E2E: 120 повідомлень → перша сторінка 50 найновіших у зростаючому порядку, `nextCursor` = id першого елемента; друга сторінка з `before` не перетинається з першою; три сторінки разом = 120 унікальних; `limit=101` → 400; користувач без доступу до приватної кімнати → 403 на `GET` і `POST`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** `npx jest`, `npm run test:e2e`, `npm run lint`, `npm run build` → чисто.
- [ ] **Step 5: Commit** `fix(messages): enforce private room access` + `feat(messages): add cursor pagination` + `refactor(messages): wrap attachment writes in transactions`.
