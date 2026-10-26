# BE-A Backend Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plug the creator-row and IP leaks, make deletes admin-only, unique room titles, room status visibility, proxy-aware IPs, and the backend bug/cleanup list from the Round 1 spec.

**Architecture:** Explicit column selection + public serializers for rooms and messages; `getClientIp` helper + HMAC `ipTag`; one migration `0012_round1_core`.

**Tech Stack:** NestJS 11, drizzle-orm, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-round1-design.md` §0–§5. Global Constraints + Contract: `docs/superpowers/plans/2026-10-26-chatix-round1/00-overview.md`.

Branch `fix/round1-backend-core` from `feat/round1`. Test DB `chatix_test_bea`.

---

### Task 1: No user rows or IPs in public payloads

**Files:** Modify `src/rooms/room/rooms.repository.ts` (every `with: { creator: true }` → explicit columns), `src/rooms/room/room.serializer.ts`; Create `src/messages/message.serializer.ts`; Modify `src/messages/messages.repository.ts`, `src/messages/messages.service.ts`, `src/messages/messages.controller.ts`, `src/messages/messages.gateway.ts`; Test `test/leaks.e2e-spec.ts`.

**Interfaces:**
- Produces: `CREATOR_COLUMNS = { id: true, username: true, pfp_url: true, forcedTitle: true } as const` (rooms repository).
- Produces: `toPublicMessage(row, ipTag: string | null): PublicMessage` with the exact Contract fields (whitelist, not spread-and-delete); `isDeleted` derived from the tombstone marker (add `messages.is_deleted boolean default false` in the migration and set it on delete).
- Produces: `toAdminMessage(row)` = public + `ipAddress` + `room { id, title }` (used by BE-B).

- [ ] **Step 1: Test** `leaks.e2e-spec.ts`: create user + room + message; fetch `GET /rooms`, `GET /rooms/:id`, `GET /rooms/by-name/:name`, `GET /messages/:roomId`, `POST /messages` response; a recursive key scan of each JSON body finds no `password`, `tokenVersion`, `ipAddress`, `banReason`, `bannedUntil` keys at any depth; message has `ipTag` matching `/^\d+\.\d+\.\d+\.#[0-9a-f]{3}$/` (IPv4) or `/::#[0-9a-f]{3}$/` (IPv6 — supertest uses `::ffff:127.0.0.1`; normalize IPv4-mapped IPv6 to IPv4 first).
- [ ] **Step 2:** Run → FAIL. - [ ] **Step 3:** Implement. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(rooms): select explicit creator columns` + `fix(messages): serialize public messages without ip addresses`.

### Task 2: Proxy-aware IP and ipTag

**Files:** Create `src/common/net/client-ip.ts`, `src/common/net/ip-tag.ts`, `src/common/net/ip-tag.spec.ts`; Modify `src/config/env.validation.ts`, `.env.example`, `src/app.setup.ts`, `src/main.ts`, `src/common/guards/user-throttler.guard.ts`, `src/messages/messages.controller.ts`, `test/utils/test-app.ts`.

**Interfaces:**
- Env: `IP_TAG_SECRET` (string ≥ 32, required), `TRUST_PROXY` (optional string), `TRUSTED_IP_HEADER` (optional, lowercase header name).
- Produces: `getClientIp(req: Request, config: ClientIpConfig): string` and `getSocketClientIp(socket: Socket, config): string` — header from `TRUSTED_IP_HEADER` first (only if set), else Express `req.ip` (respects `trust proxy`), IPv4-mapped IPv6 normalized.
- Produces: `ipTag(ip: string, secret: string): string` per spec (`a.b.c.#xyz` / `h1:h2:h3::#xyz`).
- `configureApp` sets `app.set('trust proxy', parsed TRUST_PROXY)` only when set; test harness stops setting it itself.

- [ ] **Step 1: Test** `ip-tag.spec.ts`: same IP → same tag; different last octet → (almost surely) different tag; `::ffff:93.184.216.34` → `93.184.216.#…`; IPv6 keeps 3 hextets; output never contains the last octet.
- [ ] **Step 2–4:** FAIL → implement → PASS. Add `IP_TAG_SECRET` to the local `.env` (random 48 chars, not committed) and to `.env.example` as placeholder with a comment for `TRUST_PROXY`/`TRUSTED_IP_HEADER`.
- [ ] **Step 5: Commit** `feat(net): proxy-aware client ip and ip tags`.

### Task 3: Admin-only deletes, private listing auth, 400 for validation

**Files:** Modify `src/messages/messages.controller.ts` (remove `DELETE /messages/:id`), `src/messages/messages.service.ts`, `src/admin/admin.controller.ts` (keep `DELETE /admin/messages/:id`), `src/rooms/room/room.controller.ts`, Create `src/rooms/room/dto/list-rooms.query.dto.ts`, Modify `src/auth/auth.service.ts`; Test `test/messages.e2e-spec.ts`, `test/rooms.e2e-spec.ts`.

- [ ] **Step 1: Tests:** author `DELETE /messages/:id` → 404 (route gone); admin delete → message has `isDeleted: true` and tombstone in history; `GET /rooms?publicity=private` without token → 401, `?publicity=lol` → 400; register with invalid username → 400 (not 401).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `fix(messages): make message deletion admin-only` + `fix(rooms): require auth for private room listing` + `fix(auth): return 400 for invalid registration input`.

### Task 4: Unique room titles, room states, my rooms, status reasons

**Files:** Modify `src/database/scheme.ts` (room_state enum + `rejected`; rename `quarantineReason` usage to a generic `status_reason` column — keep `quarantine_reason` column name? → add `status_reason text`, migrate existing quarantine reasons into it, drop `quarantine_reason` and the never-written `quarantined_until`), migration `drizzle/0012_round1_core.sql` (also: unique index `rooms_title_lower_unique` on `lower(title)`, `messages_room_created_idx` on `(room_id, created_at desc, id desc)`, `messages.is_deleted`); Modify rooms repository/service/controller; Test `test/rooms.e2e-spec.ts`.

**Interfaces:**
- `RoomService.createRoom/updateRoom` map pg `23505` on that index → `ConflictException({ code: 'ROOM_NAME_TAKEN', message: 'this name is taken. be original, chud.' })`.
- `GET /rooms/mine` (JwtAuthGuard) → caller's rooms, any status, with `statusReason`.
- `toPublicRoom(room, viewer?: { userId; role })` includes `statusReason` only for creator/admin.
- `findRoomByName` uses `lower(title) = lower($1)`.
- `updateRoomStatus` (admin path) loads with `findById` — no "banned → 403".

- [ ] **Step 1: Tests:** create "Chud" then "chud" → 409 with code; rename to an existing title (other case) → 409; `GET /rooms/mine` returns a `checkout` room for its creator; `GET /rooms/:id` of a quarantined room shows `statusReason` to the creator and not to another user; admin sets a `banned` room back to `active` → 200.
- [ ] **Step 2:** Check the dev data assumption: `SELECT lower(title), count(*) FROM rooms GROUP BY 1 HAVING count(*) > 1` on the test DB after migrating (must be empty; the migration should fail loudly otherwise).
- [ ] **Step 3–4:** implement → PASS.
- [ ] **Step 5: Commit** `feat(rooms): unique case-insensitive titles` + `feat(rooms): rejected state, status reasons and my rooms endpoint` + `fix(rooms): allow restoring banned rooms`.

### Task 5: English, copy and cleanup

**Files:** `src/admin/autoban.ts` (`'autoban: 3 warns. ur cooked.'`), `src/messages/messages.service.ts` (replace mojibake strings with real UTF-8 emoji, funnier: e.g. glaze `🙏🛐👑`, clown `🤓☝️🤡`; save as UTF-8), `src/users/users.service.ts` ("Foid not found" → `'no such chud. touch grass and try again.'`), `src/rooms/room/room.service.ts` (stray backtick), delete tracked file `q`, `src/main.ts` (remove duplicate `enableCors`; CORS only in `configureApp` + IO adapter), `src/config/env.validation.ts` (`MINIO_PUBLIC_URL` default `http://localhost:9000`, MinIO keys required), `package.json` (`drizzle-kit` → devDependencies, `lint` without `--fix`, add `lint:fix`). Sweep `grep -rnP "[\x{0400}-\x{04FF}]" src test` → empty.

- [ ] **Step 1:** Implement; `grep` sweep empty; `npm run build`, `npx jest`, `npm run test:e2e` green.
- [ ] **Step 2: Commit** `fix(copy): english-only strings and real emoji` + `chore: remove stray file and duplicate cors setup` + `chore(config): sane minio defaults and dev-only drizzle-kit`.
