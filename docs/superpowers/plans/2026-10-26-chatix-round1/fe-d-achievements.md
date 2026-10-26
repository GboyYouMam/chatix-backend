# FE-D Achievements UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Military-style medal rack on profiles, a "medal book", featured medals next to names in chat, animated unlock toast, and secret discovery reporting.

**Architecture:** Catalog fetched once (react-query, long staleTime); pure helpers for rack layout; ribbons drawn with CSS (striped gradients per category, border per tier) — no image assets needed.

**Tech Stack:** React 19, react-query 5, CSS Modules, `node --test`.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round1-design.md` §7. Global Constraints + Contract (Achievements): `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-round1\00-overview.md`.

Repo `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`, branch `feat/achievements-ui` from `feat/round1` (after FE-A merged; rebase after FE-C). Backend lands in parallel (BE-C) — code against the Contract.

---

### Task 1: Ribbon helpers and medal rack

**Files:** Create `src/components/achievements/ribbons.ts`, `tests/ribbons.test.ts`, `MedalRack.tsx` (+ css), `Ribbon.tsx`; Modify `src/pages/Profile/Profile.tsx`, `src/api/users/types.ts`, Create `src/api/achievements/*`.

**Interfaces:**
- `sortForRack(unlocked: {key, unlockedAt}[], catalog: AchievementDef[]): AchievementDef[]` — order: gold, silver, bronze, secret, shame; then by unlock date.
- `ribbonStyle(def): { stripes: string[]; border: string }` — category palette within the project scheme (pinks/violets/reds/neutrals); shame = black/red, secret = holo gradient.
- `MedalRack`: rows of 3 small ribbons (like a uniform bar), under the username on the profile; hover/tap tooltip (name, description, date, `% of players`); "view medal book" link. Empty state: `no medals. not even a shame one. impressive.`
- [ ] **Step 1: Test** sort order and that every catalog category maps to a palette.
- [ ] **Step 2–4** → **Step 5: Commit** `feat(achievements): medal rack on profiles`.

### Task 2: Medal book and featured medals

**Files:** Create `MedalBook.tsx` (uses the shared `Modal` from FE-A), Modify `EditProfile.tsx` (pick up to 3 featured → `PATCH /users/me/featured-achievements`), `RoomReplies.tsx`/`RoomOpPost.tsx` (tiny featured icons after the author name).
- Book: grid by category; locked = dimmed silhouette with "how to get" hint; secret locked = `???`.
- [ ] **Step 1:** implement. - [ ] **Step 2: Commit** `feat(achievements): medal book and featured medals in chat`.

### Task 3: Unlock toast and secret discovery

**Files:** Create `src/components/achievements/MedalUnlockedToast.tsx`; Modify `src/hooks/useUserSocket.ts` (`achievement:unlocked` → toast + invalidate profile/catalog), `src/utils/easterEgg.ts` callers (report `found_the_basement`, `first_rule` via `POST /achievements/discover`), `src/pages/Banned/Banned.tsx` (count appeal presses in localStorage; after next successful login report `appeal_denied` when ≥ 10), `src/api/auth`/session bootstrap (send `x-timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` on `GET /users/me`).
- Toast: "MEDAL UNLOCKED" serif headline, ribbon preview, name; slides in; reduced-motion = no slide.
- [ ] **Step 1:** implement; manual: farm aura on a fresh user → toast + rack updates without reload.
- [ ] **Step 2: Commit** `feat(achievements): unlock toast and secret discoveries`.
