# Chatix Round 1 — Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each worker executes **only its own plan file**; this file's Global Constraints and Contract apply to everyone.

**Goal:** Close the security leaks and bugs found in review, make the whole app English and mobile-friendly, rebuild the admin panel without raw UUIDs, and add achievements ("medals on a jacket") and fight club hints.

**Architecture:** Two repos. Phase 1 lands the backend/frontend core fixes (they touch the same rooms/messages code everything else builds on). Phase 2 runs admin backend, achievements backend, mobile pass, admin UI and achievements UI in parallel against the contract below.

**Tech Stack:** NestJS 11, drizzle-orm + postgres, socket.io 4, jest/supertest; React 19, Vite, react-query 5, zustand 5, CSS Modules, `node --test`.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round1-design.md` — read fully before starting.

## Workers, branches, order

Integration branch `feat/round1` in each repo, created from `feat/hardening`. Workers: Codex `gpt-6-luna` (fast) via Orca, one worktree each. Review + merge by Claude.

| Phase | Worker | Repo | Plan | Branch |
|---|---|---|---|---|
| 1 | BE-A core fixes | backend | `be-a-core.md` | `fix/round1-backend-core` |
| 1 | FE-A core fixes | frontend | `fe-a-core.md` | `fix/round1-frontend-core` |
| 2 | BE-B admin backend | backend | `be-b-admin.md` | `feat/admin-audit-moderation` |
| 2 | BE-C achievements backend | backend | `be-c-achievements.md` | `feat/achievements-backend` |
| 2 | FE-B mobile | frontend | `fe-b-mobile.md` | `feat/mobile-layout` |
| 2 | FE-C admin UI | frontend | `fe-c-admin.md` | `feat/admin-panel-v2` |
| 2 | FE-D achievements UI | frontend | `fe-d-achievements.md` | `feat/achievements-ui` |

Merge order in phase 2: backend BE-B → BE-C; frontend FE-B → FE-C → FE-D. The next branch rebases onto `feat/round1` before merge.

## Global Constraints

- **Roflo style:** every screen, toast, empty state and error keeps the project voice (lowercase, brainrot/trolling: "chud", "mogged", "cooked", "aura"), tokens from `src/index.css` (`--bg #09090b`, `--surface #18181b`, `--primary #fa4d98`, `--text`, `--muted`, `--border`, plus new `--danger` and `--warn` added by FE-A), serif logo/headings (Times New Roman, letter-spacing 4px), Courier New for mono. No neutral/corporate screens.
- **English only** — UI copy, toasts, backend errors, stored strings, code comments.
- **Mobile:** every screen usable at 375 px width, no horizontal page scroll, tap targets ≥ 40 px.
- **Tests only where they catch real risk** (security, races, aura/debt money, anti-cheat, regressions of bugs fixed here). No mock-mirroring tests, no trivial DTO/serializer tests.
- **No raw UUIDs shown to users** (admins get names/titles; ids only behind a "copy id" button).
- **Migrations:** only BE-A, BE-B, BE-C generate them, numbered `0012_round1_core`, `0013_admin_audit`, `0014_achievements`. A worker that rebases after another migration landed deletes its own migration + snapshot, rebases, and regenerates so the drizzle snapshot chain stays linear.
- **New backend deps:** none. **New frontend deps:** none.
- **Git:** identity `GboyYouMam <kozahar185@gmail.com>` (already in repo config, don't change); Conventional Commits `<type>(<scope>): <desc>`; one logical step = one commit, at least one commit per task; never squash into one commit, never `git reset --soft`; no Co-Authored-By / AI trailers; don't push, don't merge, don't touch `main`/`feat/round1`.
- **Files:** write with apply_patch or Node `fs.writeFileSync(..., 'utf8')`, never PowerShell `Set-Content`/`Out-File` (adds BOM). No BOM in changed files.
- **Lint:** every changed/new file has 0 eslint errors (backend `npx eslint <file>`; frontend `npm run lint`) and passes prettier.
- **Done means:** backend `npm run build`, `npx jest`, `npm run test:e2e` (own test DB, see below) green; frontend `npm run lint`, `npm run build`, `npm test` green.
- **Test DB per backend worker:** `chatix_test_bea`, `chatix_test_beb`, `chatix_test_bec` on `localhost:5433` (credentials from the backend `.env`); never touch the `chatix` database.

## Contract (backend ↔ frontend)

**Rooms**
- Room states: `active | checkout | banned | quarantined | rejected`. UI labels: live / in review / banned / quarantined / rejected.
- Public room: `{ id, title, topic, description, publicity, hasPassword, status, createdAt, creator: { id, username, pfp_url, forcedTitle } }`. Creator and admins additionally get `statusReason: string | null` (quarantine/reject reason). No user row fields beyond those four, ever.
- `GET /rooms/mine` (auth) → the caller's rooms in any status, newest first, with `statusReason`.
- `POST /rooms`, `PATCH /rooms/:id`: duplicate title (case-insensitive) → `409 { code: 'ROOM_NAME_TAKEN', message: 'this name is taken. be original, chud.' }`.
- `GET /rooms?publicity=private` requires auth; `publicity` ∈ `public|private`.
- `GET /rooms/by-name/:name` matches case-insensitively.

**Messages**
- Public message: `{ id, roomId, cipherText, createdAt, isDeleted, ipTag, author: { id, username, pfp_url, forcedTitle, isMogged, featuredAchievements: string[] }, attachments }`. `ipTag` like `93.184.216.#a7f`. Never `ipAddress`.
- Admin message (admin endpoints): same + `ipAddress`, `room: { id, title }`.
- Socket `joinRoom` payload is `{ roomId }` (object, validated by `JoinRoomDto`) — emit it on every `connect`.
- Room creator gets `room:status { roomId, status, statusReason }` on their user room when an admin approves/rejects/quarantines.
- Deleting: admin only (`DELETE /admin/messages/:id`); `DELETE /messages/:id` is removed. Deleted messages keep the tombstone text and `isDeleted: true` in history and in the `messageDeleted { id }` socket event (frontend renders the tombstone in place, not removal).

**Admin (BE-B)**
- `GET /admin/stats` → `{ roomsInReview, activeBans, warnsToday, autobansThisWeek }`.
- `GET /admin/rooms?status=checkout&page&limit` → moderation queue (AdminRoomDto list).
- `PATCH /admin/rooms/:id/approve` → `active`; `PATCH /admin/rooms/:id/reject { reason }` → `rejected`; existing quarantine/unquarantine stay.
- Audit item: `{ id, createdAt, admin: { id, username } | null, actionKey, targetType: 'user'|'room'|'message'|null, targetId, targetLabel, success, statusCode, details: { reason?, before?, after? } }`. Only mutations are logged.
- `GET /admin/audit-logs?adminId&actionKey&targetType&targetId&success&from&to&page&limit`.
- `actionKey` values: `user.ban`, `user.unban`, `user.warn`, `user.warn_revoke`, `user.modifiers`, `user.vaporize`, `room.approve`, `room.reject`, `room.quarantine`, `room.unquarantine`, `room.status`, `message.delete`.
- `GET /admin/users/:id/ips` → `[{ ip, lastSeenAt, messages }]`; `GET /admin/users/:id/messages?page&limit` → admin messages.

**Achievements (BE-C)**
- `GET /achievements/catalog` (public) → `[{ key, name, description, category, tier: 'bronze'|'silver'|'gold'|'shame'|'secret', icon, unlockedPercent }]`; secret entries return `name: '???'`, `description: 'secret. go find it.'` unless the caller unlocked them.
- Profile (`GET /users/profile/:username`) adds `achievements: [{ key, unlockedAt }]`, `featuredAchievements: string[]`, `fightTitle: string | null`.
- `PATCH /users/me/featured-achievements { keys: string[] }` (max 3, must be unlocked).
- `POST /achievements/discover { key }` — secret keys only (`found_the_basement`, `first_rule`, `appeal_denied`, `night_owl`), auth, throttled.
- Socket (default namespace, user room): `achievement:unlocked { key }`.
- Time zone: frontend sends `x-timezone: <IANA>` on `GET /users/me`; backend stores a valid value in `users.timezone`.

## Review Focus

1. **Two tabs, two accounts**: logging in or out in one tab updates the other immediately; a 401 for a stale token never wipes a newer session. Test — FE-A Task 1.
2. **Nested user rows leaking**: any room/message payload containing `password`, `tokenVersion` or `ipAddress` for non-admins. Test — BE-A Task 1 (deep scan of response JSON).
3. **Duplicate room names with different case** (`Chud` vs `chud`) are rejected on create and on rename. Test — BE-A Task 4.
4. **Socket reconnect mid-thread** keeps receiving new messages and backfills missed ones. Manual check — FE-A Task 2.
5. **Achievement granted twice under concurrency** (two farms in parallel crossing a threshold) produces one row and one toast. Test — BE-C Task 2.

## Final integration (Claude)

- Merge, run all suites, apply migrations to the dev DB (backup first), run backfill.
- Browser QA desktop + 375 px: rooms (create → "in review", my rooms, approve in admin → live), private room flow, IP tags, admin dashboard/queue/user dossier/audit sentences, achievements (farm → unlock toast → medal rack → featured in chat), QTE pad on touch emulation, hints, ban screen, English sweep.
- Ask the user before push/PR.
