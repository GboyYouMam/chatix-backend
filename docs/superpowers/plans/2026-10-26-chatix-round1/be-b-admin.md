# BE-B Admin Audit & Moderation Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Human-readable audit log (action keys, target labels, before/after, no GET noise, filters), dashboard stats, moderation queue (approve/reject), user IP history and messages for the admin dossier.

**Architecture:** Audit metadata is declared per admin route with a decorator (`@AuditAction('user.ban')`) and enriched in the service layer (before/after); the interceptor only logs non-GET routes that carry the decorator.

**Tech Stack:** NestJS 11, drizzle-orm, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-round1-design.md` §6. Global Constraints + Contract (Admin section): `docs/superpowers/plans/2026-10-26-chatix-round1/00-overview.md`.

Branch `feat/admin-audit-moderation` from `feat/round1` (after BE-A merged). Migration `0013_admin_audit`. Test DB `chatix_test_beb`.

---

### Task 1: Audit schema and action metadata

**Files:** Modify `src/database/scheme.ts` (`admin_audit_logs`: add `action_key varchar(40)`, `target_label varchar(255)`, index `(target_type, target_id, created_at)`); migration `drizzle/0013_admin_audit.sql` (backfill `action_key` for existing rows from method+path where unambiguous, else `'legacy'`; delete existing GET rows); Create `src/admin/audit-action.decorator.ts`; Modify `src/admin/admin-audit.interceptor.ts`, `src/admin/admin-activity-logger.service.ts`, `src/admin/admin.controller.ts`, `src/rooms/room/room.controller.ts` (status route), every admin mutation route.

**Interfaces:**
- `@AuditAction(key: AuditActionKey, targetType: 'user'|'room'|'message')` — `AuditActionKey` union = Contract list.
- Interceptor skips GET and routes without the decorator; stores `actionKey`, `targetType`, `targetId`, `success`, `statusCode`, `details`.
- `AuditContext` (request-scoped via `AsyncLocalStorage` or `request.auditContext`): services call `audit.setTarget(label)`, `audit.setDiff(before, after)`, `audit.setReason(reason)`; the interceptor reads it when writing.

- [ ] **Step 1: Test (e2e):** admin `GET /admin/users` writes no audit row; admin bans a user with reason → one row `actionKey: 'user.ban'`, `targetLabel` = username, `details.reason`, `details.before.bannedUntil = null`, `details.after.bannedUntil` set; aura delta −50 → `before.aura 1000`, `after.aura 950`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(admin): audit action keys, target labels and diffs` + `perf(admin): stop logging admin reads`.

### Task 2: Audit query API

**Files:** Modify `src/admin/admin.controller.ts`, `src/admin/admin.repository.ts`, Create `src/admin/dto/audit-query.dto.ts`.

- `GET /admin/audit-logs` with Contract filters; response items per Contract (`admin { id, username }` joined).
- [ ] **Step 1: Test:** filter by `targetType=user&targetId=<id>` returns only that user's timeline; `actionKey=user.warn` filter works; `from/to` bounds.
- [ ] **Step 2–4** → **Step 5: Commit** `feat(admin): filterable audit log query`.

### Task 3: Dashboard stats and moderation queue

**Files:** Modify admin controller/service/repository; room service for approve/reject.

- `GET /admin/stats` → `{ roomsInReview, activeBans, warnsToday, autobansThisWeek }` (UTC day/week; single query each, no N+1).
- `GET /admin/rooms?status=checkout` (filter added to existing list).
- `PATCH /admin/rooms/:id/approve` → `active`, `statusReason = null`; `PATCH /admin/rooms/:id/reject { reason }` (1–200 chars) → `rejected`; both audited (`room.approve`/`room.reject`), both emit `admin:room_updated` and notify the creator via `user:updated`-style event `room:status { roomId, status, statusReason }` to `user:{creatorId}`.
- [ ] **Step 1: Test:** approve moves a checkout room to the lobby; reject stores reason visible in creator's `GET /rooms/mine`; non-admin → 403.
- [ ] **Step 2–4** → **Step 5: Commit** `feat(admin): dashboard stats and room moderation queue`.

### Task 4: User dossier data

**Files:** Modify admin controller/service/repository.

- `GET /admin/users/:id/ips` → distinct IPs from the user's messages with `lastSeenAt` and count (newest first, max 20).
- `GET /admin/users/:id/messages?page&limit` → `toAdminMessage` list with room titles (from BE-A).
- [ ] **Step 1: Test:** two messages from two IPs → two rows with counts; non-admin → 403.
- [ ] **Step 2–4** → **Step 5: Commit** `feat(admin): user ip history and message list`.
