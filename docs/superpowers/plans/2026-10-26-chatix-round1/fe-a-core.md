# FE-A Frontend Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cross-tab sessions, socket reconnect, error handling and copy; add room status visibility, unique-name and moderation toasts, IP tags, shared Modal, fight club hints; English everywhere.

**Architecture:** Pure helpers (tested with `node --test`) + small hooks; one `Modal` and one `StatusPill` component; query-key factory for rooms/messages.

**Tech Stack:** React 19, react-query 5, zustand 5, socket.io-client, CSS Modules.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round1-design.md` §0–§4, §8. Global Constraints + Contract: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-round1\00-overview.md`.

Repo `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`, branch `fix/round1-frontend-core` from `feat/round1`. Backend changes land in parallel (BE-A) — code against the Contract. **Do not** do the mobile CSS pass (FE-B owns it); keep CSS changes to what your features need.

---

### Task 1: One session across tabs

**Files:** Create `src/lib/sessionSync.ts`, `tests/sessionSync.test.ts`; Modify `src/store/authStore.ts`, `src/api/client.ts`, `src/App.tsx` (or `main.tsx`).

**Interfaces:**
- Produces (pure, no imports): `shouldLogoutOn401(requestToken: string | null, currentToken: string | null): boolean` — true only when both are non-null and equal.
- Produces: `startSessionSync(): () => void` — `window` `storage` listener for key `chatix-auth` → `useAuthStore.persist.rehydrate()`; when the rehydrated token changes, `queryClient.clear()`. Started once in `App`.
- `client.ts` 401 handler reads the request's `Authorization` header token and uses `shouldLogoutOn401`; otherwise just rejects. Logout also shows toast `session ended. log back in, bum.`

- [ ] **Step 1: Test:** `shouldLogoutOn401('a','a')` true; `('a','b')` false; `('a', null)` false; `(null,'a')` false.
- [ ] **Step 2–4:** FAIL → implement → PASS. Manual: two tabs, log out in one → other tab shows logged out without reload; log in as another user in tab B → tab A switches user.
- [ ] **Step 5: Commit** `fix(auth): sync session across tabs and ignore stale 401s`.

### Task 2: Room socket + message cache

**Files:** Create `src/lib/queryKeys.ts`, `src/hooks/rooms/messageCache.ts`, `tests/messageCache.test.ts`; Modify `src/hooks/rooms/useRoomSocket.ts`, `src/pages/Rooms/Room.tsx`, `src/components/rooms/RoomReplies.tsx`, `src/api/messages/types.ts`.

**Interfaces:**
- `queryKeys = { rooms: (publicity?) , room: (id), myRooms: () , messages: (roomId), profile: (username) }` — replace inline keys in rooms/messages/profile code.
- `appendMessageToPages(old, msg)` (pure): returns `old` if missing or duplicate id; works when `pages[0]` has no items; `markMessageDeleted(old, id)` sets `isDeleted` + tombstone text in place.
- Socket: `on('connect')` → `emit('joinRoom', { roomId })` (every connect incl. reconnect) and on reconnect invalidate `queryKeys.messages(roomId)`; `messageDeleted` → `markMessageDeleted` (tombstone stays in place). Remove all listeners on cleanup.
- Message type per Contract (`ipTag`, `isDeleted`, `author.featuredAchievements`); render `[HOST: {ipTag}]`.

- [ ] **Step 1: Test** `messageCache.test.ts`: append to empty first page; duplicate id ignored; `markMessageDeleted` keeps position.
- [ ] **Step 2–4:** FAIL → implement → PASS. Manual: kill and restart backend while in a room → after reconnect new messages arrive.
- [ ] **Step 5: Commit** `refactor(rooms): shared query keys and message cache helpers` + `fix(rooms): rejoin room after socket reconnect`.

### Task 3: Errors, retries, toasts

**Files:** Modify `src/lib/queryClient.ts`, `src/components/Provider.tsx`, `src/index.css` (add `--danger: #ff3b5c`, `--warn: #ffb547`), `src/hooks/useAuth.ts`, `src/components/rooms/RoomReplyForm.tsx`, `src/pages/Rooms/Rooms.tsx`, `src/pages/Rooms/Room.tsx`, `src/pages/Profile/EditProfile.tsx`, `src/pages/Profile/Profile.tsx`, `src/api/*/*.service.ts` (encodeURIComponent for path params).

- QueryClient: `retry: (count, err) => status 4xx ? false : count < 1`.
- Error toast style uses `--danger`; success `--primary`; info `--muted`.
- Login: network/5xx → `can't reach the server. try again, chud.`; 401 → `wrong username or password.`; fix "profile profile".
- Reply form: `notify.error(err)` (server message); quarantined/locked room → textarea disabled + banner.
- Rooms list / room page: error state with retry (`the lobby is on fire. [retry]`), not "no rooms"/infinite loading.
- Private room 403 on messages → navigate to join page + `private. know the password or leave.`
- Edit profile: always send `vibe` and `description` (empty allowed), counters (50 / 500), real error message.
- Remove `console.log`/`console.error`; profile optimistic updates rollback via snapshot in `onMutate`/`onError`.

- [ ] **Step 1:** Implement; manual check of each case against the running backend.
- [ ] **Step 2: Commit** per area: `fix(api): no retries on 4xx and encoded path params`, `fix(toasts): distinct error style and real server messages`, `fix(rooms): error states and private room redirect`, `fix(profile): allow clearing fields and show real errors`.

### Task 4: Room status, names, moderation

**Files:** Create `src/components/rooms/StatusPill.tsx` (+ css), `src/components/rooms/MyRooms.tsx` (+ css); Modify `src/hooks/rooms/useCreateRoom.ts`, `src/hooks/rooms/useUpdateRoom.ts`, `src/pages/Rooms/Rooms.tsx`, `src/pages/Rooms/Room.tsx`, `src/components/rooms/RoomOpPost.tsx`, `src/api/rooms/*`.

- Create toast: `room sent to the mods. u have to wait son 😭`; 409 `ROOM_NAME_TAKEN` → `this name is taken. be original, chud.`
- `StatusPill({ status })`: live / in review / quarantined / banned / rejected, colours from tokens (`rejected`/`banned` → `--danger`, `checkout` → `--warn`).
- "my rooms" section on the rooms page (only when logged in and the user has non-live rooms) using `GET /rooms/mine`, with pill + `statusReason`.
- Room page banner for non-live rooms (`this room is under review. replies paused.` / quarantine reason / rejected reason).

- [ ] **Step 1:** Implement; manual: create a room → toast + appears in my rooms as "in review".
- [ ] **Step 2: Commit** `feat(rooms): status pill, my rooms and moderation copy`.

### Task 5: Modal primitive, a11y, internal ids, copy sweep, hints

**Files:** Create `src/components/ui/Modal.tsx` (+ css) on native `<dialog>` (`showModal`, Esc, focus, one close glyph `✕`); Modify `CreateRoomModal.tsx`, `EditRoomModal.tsx` (use `Modal`; replace `window.confirm` with the existing confirm-dialog pattern), `CreateFightModal.tsx`, `RoomCard.tsx` (real `Link`/`button`), `Room.tsx` (`aria-label` on icon button), `RoomOpPost.tsx` (no `№OP_<id>`), `EditRoomModal.tsx` (no `[ID: …]`), `Duel.tsx` (no `match <uuid>`), `DuelResultOverlay.tsx` (cancelled → `opponent bailed. no stakes moved.`), `src/store/fightClubStore.ts` and others (English comments), `package.json` (remove unused `lucide`). Create `src/utils/fightHints.ts`, `tests/fightHints.test.ts`; Modify `src/App.tsx` (route-change listener), `EditProfile.tsx` (rotating vibe placeholder incl. `first rule of this profile: we don't talk about the basement`), `Rooms.tsx` (search placeholder occasionally `ask nobody about rule #1`).

**Interfaces:** `shouldShowRareHint(now: number, lastShownAt: number | null, roll: number): boolean` — true when `roll < 1/40` and ≥ 24 h since last shown; `RARE_HINTS: readonly string[]` (≥ 4 lines, e.g. `one of these rooms is hiding a basement.`, `first rule: you don't type the first rule. or do you`).

- [ ] **Step 1: Test** `fightHints.test.ts`: roll 0.01 & never shown → true; roll 0.5 → false; shown 2 h ago → false; shown 25 h ago + low roll → true.
- [ ] **Step 2–4:** implement → PASS; copy sweep: one back glyph `←`, "aura"/"debt" (no `$`/"credits"), one date formatter `formatDate` in `src/utils/date.ts`, English only (`grep -rnP "[\x{0400}-\x{04FF}]" src` empty).
- [ ] **Step 5: Commit** `feat(ui): shared modal primitive and accessible room cards`, `fix(ui): hide internal ids`, `feat(fight-club): rare hints and placeholders`, `chore: english comments and remove unused lucide`.
