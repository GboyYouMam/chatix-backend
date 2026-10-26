# BE-3 Admin, Warnings & Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Адмінка отримує detail-ендпоінти, camelCase-відповіді, коректні модифікатори (null очищає, дельти), автобан після 3 активних варнів, realtime-події для адмінки, користувача і чатів; профіль віддає активні варни; аудит покриває всі адмінські дії; атомарні оновлення аури/боргу/респекту.

**Architecture:** Серіалізатор `toAdminUser` — єдине джерело форми адмін-юзера. Усі мутації адмінки повертають оновлену сутність і публікують події через `RealtimeService` (BE-0). Автобан — частина транзакції видачі варну.

**Tech Stack:** NestJS 11, drizzle-orm, class-validator, socket.io, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-hardening-design.md` (§8, §10 «Стрічка варнів» бек-частина, §11 атомарні оновлення, §12). Global Constraints: `docs/superpowers/plans/2026-10-26-chatix-hardening/00-overview.md`.

Гілка: `feat/admin-autoban-realtime` від `feat/hardening` (після злиття BE-0).

**Consumes з BE-0:** `RealtimeService.emitToUser | emitToAdmins | emitToRoom | disconnectUser`, `UsersRepository.bumpTokenVersion(userId, tx?)`, `DbOrTx`, колонки `banReason`, `autoBannedAt`, `tokenVersion`, `createTestApp`, `registerAndLogin`, `makeAdmin`. **З BE-1 (паралельно):** `toPublicRoom` з `src/rooms/room/room.serializer.ts` — якщо BE-1 ще не злитий, створити ідентичну функцію в тому ж файлі з тим самим підписом (`toPublicRoom<T extends { password?: string | null }>(room: T): Omit<T,'password'> & { hasPassword: boolean }`); при злитті лишиться одна.

---

### Task 1: Форма відповідей і detail-ендпоінти

**Files:**
- Create: `src/admin/admin.serializer.ts`, `src/admin/admin.serializer.spec.ts`
- Modify: `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`, `src/admin/admin.repository.ts`
- Test: `test/admin.e2e-spec.ts`

**Interfaces:**
- Produces: `AdminUserDto { id; username; role: 'user'|'admin'; pfpUrl: string|null; description: string|null; vibe: string|null; aura: number; debt: number; respectCount: number; isClown: boolean; isMogged: boolean; adminGlazeMode: boolean; canChangeProfile: boolean; forcedTitle: string|null; bannedUntil: string|null; banReason: string|null; isAutoBanned: boolean; yapCooldown: string|null; activeWarningsCount: number; createdAt: string }`; `toAdminUser(row, activeWarningsCount: number): AdminUserDto` (`isAutoBanned = autoBannedAt != null && bannedUntil > now`).
- Produces: `AdminRoomDto` = `toPublicRoom(room)` + поля статусу/карантину в camelCase (взяти зі схеми) + `messagesCount: number`.
- Produces: `GET /admin/users/:id` → `AdminUserDto` (404 `'no such chud'`); `GET /admin/rooms/:id` → `AdminRoomDto`; списки `GET /admin/users|rooms` → `{ items: AdminUserDto[] | AdminRoomDto[]; total; page; limit }` (поточну форму пагінації зберегти, лише елементи через серіалізатор). `activeWarningsCount` у списку — одним агрегатним запитом (підзапит/`LEFT JOIN ... GROUP BY`), не N+1.

- [ ] **Step 1: Тести.** Serializer: snake-поля (`pfp_url`, `created_at`) перетворені, `password` і `tokenVersion` відсутні. E2E: `GET /admin/users/:id` як адмін → 200 з `activeWarningsCount`; як звичайний юзер → 403; список не містить жодного ключа з `_`.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(admin): add detail endpoints and camelcase admin dtos`.

### Task 2: Модифікатори: null, дельти, причина бану

**Files:**
- Modify: `src/admin/dto/update-user-modifiers.dto.ts`, `src/admin/admin.controller.ts:40-55`, `src/admin/admin.service.ts`, `src/admin/admin.repository.ts`
- Test: `src/admin/admin.service.spec.ts`, `test/admin.e2e-spec.ts`

**Interfaces:**
- `UpdateUserModifiersDTO`: `bannedUntil?: string | null`, `yapCooldown?: string | null`, `forcedTitle?: string | null`, `banReason?: string | null` (≤ 200) — `@IsOptional()` + `@ValidateIf((_, v) => v !== null)` перед типовим валідатором; `auraDelta?: number`, `debtDelta?: number` (`@IsInt()`, |n| ≤ 1_000_000); поля `aura`/`debt` (абсолютні) **видалити**; булеві — як є.
- Семантика: ключ відсутній → не чіпати; `null` → очистити; `bannedUntil: null` очищає також `banReason` і `autoBannedAt`; встановлення `bannedUntil` у майбутнє → у тій самій транзакції `bumpTokenVersion`, після коміту `disconnectUser` + `emitToUser(id, 'user:banned', { bannedUntil, banReason })` (емітити до відключення).
- Produces: `AdminService.updateModifiers(adminId: string, userId: string, dto): Promise<AdminUserDto>`; дельти — `sql\`aura + ${n}\`` (мінус дозволено).
- Після будь-якої зміни: `emitToAdmins('admin:user_updated', { user })`, `emitToUser(userId, 'user:updated', { userId })`.

- [ ] **Step 1: Тести.** `{ bannedUntil: null }` на забаненому → `bannedUntil` і `banReason` стали `null` (Review Focus #5, друга половина); `{ debtDelta: 100 }` двічі поспіль → борг +200; `{ auraDelta: -5000 }` при аурі 1000 → `-4000`; `{}` → нічого не змінено; бан у майбутнє → `tokenVersion` +1 і викликано `disconnectUser`; `{ aura: 5 }` → 400 (поле видалено).
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(admin): allow clearing modifiers and use atomic deltas`.

### Task 3: Автобан

**Files:**
- Create: `src/admin/autoban.ts`, `src/admin/autoban.spec.ts`
- Modify: `src/admin/admin.service.ts` (видача і відкликання варну), `src/admin/admin.repository.ts`

**Interfaces:**
- Produces (`autoban.ts`): `AUTOBAN_THRESHOLD = 3`, `AUTOBAN_DURATION_MS = 7 * 24 * 60 * 60 * 1000`, `AUTOBAN_REASON = 'автобан: 3 варни. ur cooked.'`; `computeAutoban(activeWarnings: number, currentBannedUntil: Date | null, now: Date): { bannedUntil: Date } | null` — `null`, якщо `activeWarnings < 3`; інакше `bannedUntil = max(currentBannedUntil, now + 7d)`.
- `AdminService.createWarning(adminId, userId, dto): Promise<{ warning; user: AdminUserDto; autoBanned: boolean }>` — транзакція: insert варну → `count(*) where revokedAt is null` → синхронізувати `users.warns_count` з цим числом → `computeAutoban` → якщо не `null` і бан реально змінився: `bannedUntil`, `banReason = AUTOBAN_REASON` (лише якщо новий бан довший за існуючий), `autoBannedAt = now`, `bumpTokenVersion`. Після коміту: лог `user.autobanned` (`warn`), аудит, realtime як у Task 2 + `emitToUser(userId, 'user:updated', ...)`.
- Відкликання (`DELETE users/:userId/warnings/:warningId`) ставить `revokedAt`, синхронізує `warns_count`, **бан не знімає**, публікує `admin:user_updated`.

- [ ] **Step 1: Тести.** `computeAutoban(2, null, now)` → `null`; `(3, null, now)` → `now + 7d`; `(3, now + 30d, now)` → `now + 30d` (Review Focus #5, перша половина); `(4, now - 1d, now)` → `now + 7d`. Service: третій активний варн → `autoBanned: true`, `tokenVersion` +1; два активні + один відкликаний + новий → `autoBanned: false`; відкликання після автобану → `bannedUntil` не змінився.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(admin): autoban users after three active warnings`.

### Task 4: Realtime для адмінських дій і повне покриття аудитом

**Files:**
- Modify: `src/admin/admin.service.ts` (quarantine, unquarantine, deleteMessage, vaporize), `src/admin/admin-audit.interceptor.ts`, `src/rooms/room/room.controller.ts:50-60` (`PATCH :id/status`), `src/messages/messages.controller.ts:45` (`DELETE :id`), `src/messages/messages.service.ts`
- Test: `src/admin/admin.service.spec.ts`

**Interfaces:**
- Події (через `RealtimeService`): карантин/розкарантин → `emitToRoom(roomId, 'roomQuarantined', { roomId, quarantined: boolean })` + `emitToAdmins('admin:room_updated', { room: AdminRoomDto })`; видалення повідомлення (адміном або автором) → `emitToRoom(roomId, 'messageDeleted', { id })` + для адміна `emitToAdmins('admin:message_deleted', { id })`; vaporize → `emitToUser(id, 'user:banned', { bannedUntil: null, banReason: 'vaporized' })`, потім `disconnectUser(id)`, `emitToAdmins('admin:user_updated', { user: null, id })`; прибрати подвійний `findById` у vaporize.
- `AdminAuditInterceptor` повішати на `PATCH /rooms/:id/status` і `DELETE /messages/:id`; він пише запис лише якщо `req.user.role === 'admin'`. Кожен запис аудиту також логується як `admin.action` (`info`, `adminId`, `action`, `targetId`).

- [ ] **Step 1: Тести** з моком `RealtimeService`: vaporize → `emitToUser` викликано **до** `disconnectUser`; видалення повідомлення адміном → `messageDeleted` у кімнату; інтерцептор для не-адміна не пише аудит.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(admin): broadcast moderation events and audit all admin actions`.

### Task 5: Профіль з активними варнами і атомарні оновлення користувача

**Files:**
- Modify: `src/users/users.service.ts` (`getUserProfile`, `auraFarming`:143-158, `giveProfileRespect`), `src/users/users.repository.ts:118` (`payDebt`)
- Test: `src/users/users.service.spec.ts`, `test/users.e2e-spec.ts` (якщо файл уже створив BE-1 — дописати в нього окремий `describe`)

**Interfaces:**
- `GET /users/profile/:username` додає `activeWarnings: { reason: string; createdAt: string }[]` (лише `revokedAt IS NULL`, новіші першими, **без** `adminId`); решта полів відповіді без змін.
- `auraFarming` — `sql\`aura + n\`` без ліміту і без throttler (фіча); `payDebt` — атомарний `UPDATE ... RETURNING` (семантику погашення не змінювати, лише прибрати read-then-write); `giveProfileRespect` — інкремент колонки `respect_count` в тій самій транзакції, що вставка респекту; профіль читає `respectCount` з колонки замість live-count.

- [ ] **Step 1: Тести.** E2E: варн видано і відкликано → `activeWarnings` порожній; два активні → два елементи без `adminId`. Unit/E2E: 20 паралельних `POST /users/farm-aura` → аура зросла рівно на суму 20 нарахувань.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** `npx jest`, `npm run test:e2e`, `npm run lint`, `npm run build` → чисто.
- [ ] **Step 5: Commit** `feat(users): expose active warnings on profiles` + `fix(users): make aura, debt and respect updates atomic`.
