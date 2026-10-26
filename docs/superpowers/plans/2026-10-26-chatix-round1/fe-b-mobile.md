# FE-B Mobile Layout & Touch QTE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-facing screen works at 375 px; fight club is playable on touch devices with a QTE pad; hover-only interactions get tap equivalents.

**Architecture:** CSS-first (`@media (max-width: 600px)` and `(max-width: 900px)`), plus one pure helper for the QTE pad and `(pointer: coarse)` detection.

**Tech Stack:** React 19, CSS Modules, `node --test`.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round1-design.md` §5. Global Constraints: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-round1\00-overview.md`.

Repo `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`, branch `feat/mobile-layout` from `feat/round1` (after FE-A merged). Admin pages are out of scope (FE-C).

---

### Task 1: Touch QTE pad

**Files:** Create `src/hooks/fight-club/qtePad.ts`, `tests/qtePad.test.ts`, `src/components/fight-club/QtePad.tsx` (+ css in `Duel.module.css`); Modify `src/pages/Fight-Club/Duel.tsx`, `src/hooks/fight-club/useFightDuel.ts`.

**Interfaces:**
- `buildPadKeys(correct: string, random: () => number, size = 6): string[]` (pure): contains `correct` exactly once, `size` unique uppercase A–Z letters, order shuffled via `random`.
- `QtePad({ keys, disabled, onPress })` rendered only when `matchMedia('(pointer: coarse)')` matches; recomputed per `promptId`; buttons ≥ 56 px; press calls the same `hit(key)` as the keyboard path. Hint under the frame on touch: `tap the matching key. fast.`
- [ ] **Step 1: Test:** 1 000 runs → always 6 unique letters, contains correct once; deterministic with seeded `random`.
- [ ] **Step 2–4** → manual via Chrome device emulation: wrong tap → stun, right tap → hit.
- [ ] **Step 5: Commit** `feat(fight-club): touch qte pad`.

### Task 2: Responsive pages

**Files:** CSS modules of rooms list, room thread (`Room.module.css`, reply form, OP post, replies), profile + edit profile, auth pages, fight lobby/duel, join room (`JoinRoom.tsx` inline `width: 400px` → class), create/edit room modals, `MessageFormatter` (tap-to-expand quote preview).
- Rooms: header stacks (logo, toggle, profile button), banner ≤ 160 px tall, cards single column.
- Room thread: OP + replies full width, reply form sticky bottom, attachments wrap.
- Edit profile: visual editor becomes a 2-column grid, container padding ≤ 1rem.
- Auth: decorative image hidden ≤ 600 px.
- Lobby/duel: player panels stack, key frame ≤ 70vw.
- Quote previews: `onClick` toggles preview on touch; hover unchanged on desktop.
- [ ] **Step 1:** Implement page by page; check each at 375×812 and 768×1024 in device emulation: no horizontal scroll (`document.documentElement.scrollWidth === clientWidth`), tap targets ≥ 40 px.
- [ ] **Step 2: Commit** per page group: `feat(mobile): rooms list`, `feat(mobile): room thread`, `feat(mobile): profile pages`, `feat(mobile): auth and join pages`, `feat(mobile): fight club pages`.
