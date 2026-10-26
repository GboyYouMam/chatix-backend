# Chatix Round 1 — fixes, English, mobile, admin panel, achievements — design

Date: 2026-10-26. Builds on `2026-10-26-chatix-hardening-design.md` (merged to `feat/hardening`).
Repos: backend `chatix-backend/chatix-backend`, frontend `chatix-frontend/chatix-frontend`. Base branch for this round: `feat/hardening`.

## 0. Ground rules (apply to every item)

- **Roflo style everywhere.** Every screen, toast, empty state and error keeps the project voice: lowercase, brainrot/trolling ("chud", "mogged", "cooked", "aura"), dark `#09090b` + pink `#fa4d98`, serif logo, Courier mono. No neutral/corporate screens.
- **English only.** All UI copy, toasts, backend error messages, stored strings (e.g. autoban reason) and code comments in English. Currently non-English: `src/admin/autoban.ts:3` (backend), `src/pages/Profile/Profile.tsx:107` comment (frontend).
- **Mobile is a first-class target.** Every page usable at 375 px wide with no horizontal page scroll and tap targets ≥ 40 px.
- **Tests only where they catch real risk** (security, races, money/aura, anti-cheat, regressions). No mock-mirroring tests.
- Git identity `GboyYouMam <kozahar185@gmail.com>`, Conventional Commits, branches `<type>/<desc>`, no AI trailers.

## 1. Security fixes

1. **Creator row leak.** `GET /rooms/:id` (and anything using `rooms.repository.findById`/`findRoomByName`/lobby lists) returns the full creator row incl. bcrypt `password`, `tokenVersion`, ban fields. Select explicit creator columns everywhere (`id, username, pfp_url, forcedTitle`). Add an e2e assertion that no room response contains `password`/`tokenVersion` at any depth.
2. **IP display (imageboard style).**
   - Server computes `ipTag` for public payloads: IPv4 → first three octets + `.#` + first 3 hex chars of `HMAC-SHA256(IP_TAG_SECRET, fullIp)`, e.g. `93.184.216.#a7f`. IPv6 → first three hextets + `::#` + same 3 hex. Same IP → same tag (poster identity, imageboard-like), irreversible.
   - New env var `IP_TAG_SECRET` (min 32 chars, validated; add to `.env.example` and the local `.env`).
   - Public message payloads (history, socket broadcast, send response) contain `ipTag` only — never `ipAddress`. A `toPublicMessage` serializer with an explicit field whitelist.
   - Admin endpoints (messages list, user page) return the full `ipAddress`.
   - Frontend renders `[HOST: 93.184.216.#a7f]` where it currently renders the full IP.
   - **Proxy-aware client IP.** One helper `getClientIp(req | socket)` used by messages, the throttler tracker and sockets. Config:
     - `TRUST_PROXY` (default unset = off, IP from the socket connection, as today). When set (e.g. `1` for one proxy hop, or a comma list of proxy IPs/CIDRs) → Express `app.set('trust proxy', value)` and Socket.IO reads the client IP from `X-Forwarded-For` under the same trust rule. Never trust `X-Forwarded-For` when unset (spoofable).
     - `TRUSTED_IP_HEADER` (optional, e.g. `cf-connecting-ip` for Cloudflare): when set, the client IP is read from that header first.
     - Both documented in `.env.example`; `test/utils/test-app.ts` stops setting `trust proxy` on its own and uses the same config path.
3. **Message deletion is admin-only.** Remove author delete: `DELETE /messages/:id` becomes admin-only (or is removed in favour of `DELETE /admin/messages/:id` — keep one route, admin-only). Deleted messages render the same tombstone ("GOT DELETED LMAO CRY ABOUT IT") on live socket delete and after reload.
4. **Private room listing.** `GET /rooms?publicity=private` requires auth; `publicity` validated (`public|private`) via a query DTO.
5. **Validation errors are 400, not 401.** `AuthService.register` throws `BadRequestException` for invalid username/password (DTO already validates; keep as a guard). 401 is reserved for "token invalid".

## 2. Bug fixes

1. **Session across tabs.** One browser = one session, synced across tabs:
   - listen to `window` `storage` events for `chatix-auth` and rehydrate the zustand store (`useAuthStore.persist.rehydrate()`), so login/logout/ban in one tab applies to all tabs immediately;
   - the axios 401 handler logs out only if the rejected request's bearer token equals the current store token (a stale token from another tab/account must not wipe the current session).
   - Pure helper `shouldLogoutOn401(requestToken: string | null, currentToken: string | null): boolean` with a test.
2. **Room socket rejoin.** `useRoomSocket` re-emits `joinRoom` on every `connect` (incl. reconnect) and invalidates `['messages', roomId]` on reconnect to catch missed messages.
3. **Banned room is recoverable.** `RoomService.updateRoomStatus` loads via `findById` without the "banned → 403" guard (admin path).
4. **Message cache merge.** Extract `appendMessageToPages(old, msg)` (guards empty first page, dedupes by id); used by socket handler and send.
5. **Failed request UX.** React Query: no retry for 4xx, max 1 retry otherwise. Rooms list and room page get explicit error states (not "no rooms"/"loading").
6. **Private room without access.** On 403 from messages, redirect to the join page with toast "private. know the password or leave."
7. **Reply errors.** Reply form shows the server's message (cooldown, debt, locked) via `notify.error(err)`; when the room is quarantined the textarea is disabled with an in-voice banner.
8. **Edit profile.** Empty vibe/description can be saved (always send fields); show real server error; char counters (vibe 50, description 500).
9. **Toasts.** Error toasts visually distinct (red accent token `--danger`), success pink, info muted. Login: network/5xx → "can't reach the server. try again, chud.", 401 → "wrong username or password". Fix "profile profile" typo.
10. **Room search.** `encodeURIComponent` path params; backend `by-name` matches case-insensitively; private hit routes to the join page.
11. **Fight result copy.** Cancelled match shows "opponent bailed. no stakes moved." inside the overlay (not loss copy).
12. **Misc:** mojibake emoji in `messages.service.ts` glaze/clown texts replaced with real, funnier emoji (🙏🛐👑 / 🤓☝️🤡 style); "Foid not found" → in-voice English 404; stray `q` file deleted; `console.log`/`console.error` removed; unused `lucide` dep removed; CORS configured once (setup only); `MINIO_PUBLIC_URL` default without bucket suffix; `messages(room_id, created_at desc, id desc)` index; `RoomCard` uses a real link/button; one shared `Modal` primitive (role=dialog, Esc, focus) used by create/edit room and create fight modals; internal ids hidden from UI (`№OP_…`, `[ID: …]`, `match <uuid>`, raw `checkout`).

## 3. Rooms: unique names + moderation visibility

1. **Unique titles.** Case-insensitive unique index on `lower(title)` (migration; check existing data for duplicates first — none today). Create/update return 409 `{ code: 'ROOM_NAME_TAKEN' }`; toast "this name is taken. be original, chud."
2. **Create toast.** "room sent to the mods. u have to wait son 😭" (rooms default to `checkout`).
3. **Status visibility.**
   - Human labels: `checkout` → "in review", `active` → "live", `quarantined` → "quarantined", `banned` → "banned". One `StatusPill` component.
   - Creator sees their non-active rooms in a "my rooms" section on the rooms page with the pill and, for quarantine, the reason.
   - `quarantineReason` is returned only to the creator and admins (not to everyone).
   - Room page shows a persistent banner for non-live rooms ("this room is under review. replies paused." etc.).

## 4. English everywhere

Translate the remaining non-English strings (§0) and review all UI/backend copy for tone consistency: lowercase in-voice lines, one back-link glyph (`←`), one currency word ("aura"/"debt", not "$"/"credits" mixed), one date formatter. Autoban reason: `autoban: 3 warns. ur cooked.`

## 5. Mobile

- Breakpoints for every page: rooms list (header stacks, banner ≤ 160 px), room thread, profile (sidebars hidden ≤ 900 px — exists), edit profile (visual editor becomes a 2-column grid), auth pages (decorative image hidden/shrunk), fight lobby/duel, admin, ban screen (exists).
- Hover-only quote previews in messages get tap-to-expand.
- **Fight club QTE pad on touch devices** (`(pointer: coarse)`): under the key frame, 6 large buttons — the correct letter + 5 random distractors, positions reshuffled every prompt. Tap sends the normal `fight:hit {matchId, promptId, k}`; server validation unchanged (incl. 120 ms min reaction). Wrong tap = stun (server already handles wrong `k`). The frame itself stays non-interactive. Desktop unchanged.

## 6. Admin panel redesign

Goal: a genuinely good-looking, useful admin in the project style; **no raw UUIDs shown** anywhere (names, room titles, avatars; ids only behind a "copy id" button).

- **Audit log, human-readable.**
  - Backend: interceptor stops logging GET requests; each mutation stores `actionKey` (e.g. `user.ban`, `user.warn`, `user.modifiers`, `room.quarantine`, `room.status`, `message.delete`, `user.vaporize`), `targetLabel` (username / room title / message excerpt, denormalized at write time so it survives deletes) and, for modifiers/room changes, `details.before`/`details.after` of changed fields. New columns via migration.
  - Filters: admin, actionKey, target type, success, date range. Per-target timeline (`targetType` + `targetId`), new index `(target_type, target_id, created_at)`.
  - Frontend renders sentences: "**jes95us** banned **tester777** for 3 min — 'ur eyeline…'", "**jes95us** gave **chud123** −50 aura (1000 → 950)".
- **Dashboard:** stat tiles (rooms in review, active bans, warns today, autobans this week), moderation queue of rooms in review with approve / reject / quarantine actions, live audit feed.
- **User page (dossier):**
  - Header: avatar, username, role, badges, aura/debt big mono numbers, ban state with live countdown and reason, warn meter `[WARN n/3]`, full IP history (last N distinct IPs from messages).
  - Tabs: **moderation** (grouped actions: ban with reason & duration presets, yap cooldown, warn, clown/mog/glaze toggles, forced title, aura/debt deltas, profile lock, vaporize behind confirm), **warnings** (active/revoked), **history** (audit timeline for this user), **messages** (this user's recent messages with room titles, delete).
- **Room page:** status pill + actions (approve, quarantine with reason, ban, restore), creator, member count, message count, recent messages.
- **Messages page:** list with author name + room title + excerpt + time, filter by room/user, delete with confirm.
- Split `AdminPanel.module.css` (827 lines) into per-component modules; shared primitives (Panel, Button, StatusPill, StatTile, Tabs).
- Mobile: sidebar → top tabs (exists), tables → cards.

## 7. Achievements ("medals on a jacket")

- **Data:** catalog in code (`src/achievements/catalog.ts`: key, name, description, category, tier `bronze|silver|gold|shame|secret`, icon); table `user_achievements(user_id, key, unlocked_at, PK(user_id,key))`; `users.featured_achievements text[]` (max 3).
- **Granting:** `AchievementsService.grant(userId, key)` — idempotent (`ON CONFLICT DO NOTHING`), emits `achievement:unlocked` to `user:{id}`; called from existing events (aura farm, debt pay, fight finish, message create, room status change, warn, ban, ban expiry check on login, respect, profile visit, easter egg discovery). Counters derived from existing tables where possible; add `users.messages_count`, `users.aura_farm_count`, `users.fights_won/lost`, `users.win_streak`, `users.loss_streak` (atomic increments) where a count query would be expensive. One-off backfill script grants achievements to existing users.
- **Display:** profile **medal rack** under the username — rows of small military-style ribbons, colour by category, border by tier; hover/tap tooltip (name, how earned, date, % of players who have it). Click → "medal book" modal with all medals; locked ones as silhouettes, secret ones as "???". Users pick up to 3 featured medals, shown as tiny icons next to their name in chat. Unlock → animated "MEDAL UNLOCKED" toast.
- **Catalog (initial):**
  - aura: `first farm` (1 farm), `aura farmer` (1 000 farms), `aura god` (aura ≥ 10 000), `in the negatives` (aura < 0), `bankrupt vibes` (aura ≤ −1 000, shame).
  - debt: `first debt` (debt > 0), `debt free` (paid off ≥ 100), `debt lord` (debt ≥ 1 000), **`financial cushion`** (debt < 0), `loan shark` (debt ≤ −1 000).
  - fight club: `found the basement` (secret: easter egg), `first blood` (first win), `basement regular` (10 fights), `undefeated` (5-win streak), `high roller` (stake ≥ 500), `rage quitter` (shame), `professionally mogged` (10-loss streak, shame), `the soap market` (3 fights within an hour), `got mogged by a clown` (lose to a user with clown status, shame).
  - rooms & chat: `landlord` (first room approved), `yapper` (100 messages), `certified yapper` (1 000), `ratio'd` (your room got quarantined, shame), `necromancer` (message in a room silent for 30+ days).
  - social: `respected` (10 respects), `glazed` (100 respects), `clown certified` (got clown status), `admin's favourite` (admin glaze mode on).
  - moderation: `first warn` (shame), `cooked` (autobanned, shame), `survivor` (served a ban to the end and came back), **`actually went touch grass`** (came back after 7+ days away).
  - secret: `first rule` (typed "first rule"), `night owl` (message between 3:00–4:00 local time), `appeal denied` (pressed appeal 10 times on the ban screen).

### 7.1 Decisions (Claude's calls)

- **Fight history is persisted:** new `fights` table (id, player1, player2, winner, stake type/amount, outcome `ko|rage_quit|cancelled`, insured, created_at). Needed for fight achievements and the Round 2 `fight_record` widget. Old fights can't be backfilled.
- **Client-reported secrets** (`found the basement`, `first rule`, `appeal denied`, `night owl`) are cosmetic and accepted as spoofable: `POST /achievements/discover { key }` accepts only the secret keys, authenticated, throttled. `appeal denied` presses are counted in localStorage on the ban screen and reported after the next successful login. `night owl` uses the browser's IANA time zone, sent with login/`/users/me` and stored as `users.timezone`.
- **All "day" boundaries are UTC** (streaks, leaderboards, snapshots), except `night owl`, which uses the user's stored time zone.
- **Moderation reject** = new room state `rejected` (enum migration) with a reason; the creator sees it in "my rooms" with the reason; label "rejected", pill in red.
- **Titles:** fights stop overwriting `forcedTitle`. Fight titles ("true adam"/"sub5") move to `users.fight_title` + `fight_title_until` (24 h). Display precedence: admin `forcedTitle` > fight title (while active) > equipped shop title (Round 2). Migration moves existing "true adam"/"sub5" values out of `forced_title`.

## 8. Fight club discovery hints

- **Rare toast:** ~1 in 40 route changes, at most once per day per browser (localStorage), cryptic lines ("one of these rooms is hiding a basement.", "first rule: you don't type the first rule. or do you").
- **Edit profile:** vibe input placeholder rotates, one variant: "first rule of this profile: we don't talk about the basement".
- **Rooms search placeholder:** occasionally "ask nobody about rule #1".

## 9. Execution

Codex workers (`gpt-6-luna`, fast) via Orca, one worktree each, reviewed and merged by Claude into `feat/round1`. Final browser QA (desktop + 375 px). Push/PR only on user confirmation.
