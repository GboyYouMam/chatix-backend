# BE-C Achievements Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achievements catalog, idempotent granting from existing events, persisted fights, fight titles separated from admin titles, featured medals, secret discoveries, time zone, backfill.

**Architecture:** Catalog in code; `AchievementsService.grant` + small rule checkers called from domain services after their writes commit; counters as atomic columns where counting would be expensive.

**Tech Stack:** NestJS 11, drizzle-orm, jest, supertest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-round1-design.md` §7 and §7.1. Global Constraints + Contract (Achievements section): `docs/superpowers/plans/2026-10-26-chatix-round1/00-overview.md`.

Branch `feat/achievements-backend` from `feat/round1` (after BE-A merged; rebase after BE-B and regenerate the migration). Migration `0014_achievements`. Test DB `chatix_test_bec`.

---

### Task 1: Schema

**Files:** `src/database/scheme.ts`, migration `drizzle/0014_achievements.sql`.

- `user_achievements(user_id fk cascade, key varchar(40), unlocked_at timestamptz default now(), PK(user_id, key))`, index `(key)`.
- `fights(id uuid, player1_id, player2_id, winner_id null, stake_type, stake_amount, outcome 'ko'|'rage_quit'|'cancelled', created_at)`, indexes on each player + created_at.
- `users`: `featured_achievements text[] default '{}'`, `timezone varchar(64)`, `messages_count int default 0`, `aura_farm_count int default 0`, `fights_won int default 0`, `fights_lost int default 0`, `win_streak int default 0`, `loss_streak int default 0`, `last_seen_at timestamptz`, `fight_title varchar(50)`, `fight_title_until timestamptz`.
- Data migration: move `forced_title IN ('true adam','sub5')` into `fight_title` (with `fight_title_until = now() + 24h`), null them in `forced_title`.
- [ ] **Step 1:** generate + inspect SQL; apply to test DB. - [ ] **Step 2: Commit** `feat(db): achievements, fights history and user counters`.

### Task 2: Catalog and granting

**Files:** Create `src/achievements/catalog.ts`, `src/achievements/achievements.module.ts`, `achievements.service.ts`, `achievements.controller.ts`, `achievements.service.spec.ts`; Test `test/achievements.e2e-spec.ts`.

**Interfaces:**
- `ACHIEVEMENTS: readonly AchievementDef[]` — `{ key, name, description, category: 'aura'|'debt'|'fight'|'rooms'|'social'|'moderation'|'secret', tier, icon }` — exactly the spec §7 list (keys snake_case, e.g. `financial_cushion`, `actually_went_touch_grass`, `got_mogged_by_a_clown`), names/descriptions in-voice English.
- `AchievementsService.grant(userId, key): Promise<boolean>` — `INSERT … ON CONFLICT DO NOTHING RETURNING`; on insert emits `achievement:unlocked { key }` via `RealtimeService.emitToUser`; returns whether newly unlocked.
- `AchievementsService.evaluate(userId, trigger: AchievementTrigger)` — `trigger` ∈ `'aura'|'debt'|'fight'|'message'|'room_status'|'respect'|'warn'|'ban'|'login'`; reads the user's counters once and grants every satisfied rule for that trigger.
- `GET /achievements/catalog` with `unlockedPercent` (one aggregate query) and secret masking per Contract; `PATCH /users/me/featured-achievements`; `POST /achievements/discover` (secret keys only, throttled 10/min).

- [ ] **Step 1: Tests:** concurrent `grant` for the same key ×5 → one row and one emit (Review Focus #5); secret entry masked for a user without it and revealed after unlock; featured with a locked key → 400; discover with a non-secret key → 400.
- [ ] **Step 2–4** → **Step 5: Commit** `feat(achievements): catalog, idempotent granting and api`.

### Task 3: Wire triggers into existing flows

**Files:** `src/users/users.service.ts` (farm → `aura_farm_count+1`, aura/debt triggers; respect), `src/fight-club/*` (persist fight row on finish/rage quit/cancel; counters + streaks; fight title to `fight_title` instead of `forcedTitle`; `the_soap_market` = 3 fights in last hour from `fights`; `got_mogged_by_a_clown` = loser vs winner with `isClown`), `src/messages/messages.service.ts` (`messages_count+1`, `necromancer`, `night_owl` via `users.timezone`), `src/rooms/room/room.service.ts` + BE-B approve (`landlord`, `ratio_d`), `src/admin/admin.service.ts` (warn, autoban `cooked`), `src/auth/*` / `users/me` (`last_seen_at`, `actually_went_touch_grass` when previous `last_seen_at` ≥ 7 days ago, `survivor` when a past ban exists and user logs in after expiry; store `x-timezone` header if a valid IANA zone).
- Grants run after the main write commits (never inside the money transaction); failures are logged, never fail the request.
- [ ] **Step 1: Tests (e2e):** farm once → `first_farm`; admin sets debt −1 → `financial_cushion`; fight KO persists a `fights` row and winner gets `first_blood`; fight titles no longer touch `forcedTitle`; previous `last_seen_at` 8 days ago + `/users/me` → `actually_went_touch_grass`.
- [ ] **Step 2–4** → **Step 5: Commit** per area: `feat(achievements): aura and debt triggers`, `feat(fight-club): persist fights and fight titles`, `feat(achievements): chat, rooms, social and moderation triggers`.

### Task 4: Profile fields and backfill

**Files:** `src/users/users.service.ts` (profile: `achievements`, `featuredAchievements`, `fightTitle` (null when expired)); Create `scripts/backfill-achievements.ts`, `package.json` script `db:backfill-achievements`.
- Backfill computes counters from existing data where possible (`messages_count` from messages, respect counts, aura/debt states, warns, bans) and grants matching achievements; idempotent; prints totals.
- [ ] **Step 1:** run twice on test DB → second run grants 0. - [ ] **Step 2: Commit** `feat(achievements): profile fields and backfill script`.
