# Chatix Round 2 — widgets, aura shop, economy, room themes, music — design

Date: 2026-10-26. Starts after Round 1 (`2026-10-26-chatix-round1-design.md`) is merged. Same ground rules as Round 1 §0 (roflo style, English only, mobile-first, risk-driven tests, git conventions).

## 1. Profile music (Spotify / SoundCloud)

- `users.profile_track_url` (nullable). Settable from edit profile.
- Backend validates and normalizes: allowed hosts `open.spotify.com` (`/track|album|playlist/<id>`, strips `intl-xx/` and query) and `soundcloud.com` / `on.soundcloud.com` (resolved to the canonical `soundcloud.com/<user>/<track|sets/...>`). Anything else → 400 "spotify or soundcloud links only, chud."
- Frontend player in the **Now playing** widget: Spotify → `https://open.spotify.com/embed/<type>/<id>?theme=0` iframe (compact height); SoundCloud → `https://w.soundcloud.com/player/?url=<encoded>&color=%23fa4d98&auto_play=false&visual=false` iframe. No autoplay. Caption "currently rotting to".

## 2. Profile widgets

- Widgets render in a 2-column grid under the profile card (1 column on mobile). Owner toggles and reorders them in edit profile; stored as `users.widget_layout jsonb` = ordered list of widget keys (validated against the catalog).
- Catalog (13):
  1. `now_playing` — §1 player.
  2. `medal_rack` — achievements rack (from Round 1).
  3. `aura_chart` — 30-day aura line as a stock ticker: "$AURA ▼ -12% today. bearish". Needs `aura_history(user_id, day, aura)` daily snapshot (job at midnight + on change).
  4. `fight_record` — W/L, current streak, last fight ("last seen getting mogged by @x").
  5. `top_glazers` — top respecters.
  6. `debt_meter` — debt bar: "financially cooked: 73%"; negative debt → "financial cushion: secured".
  7. `yap_stats` — message count, top rooms, "most cooked take" (message with most `>>` replies).
  8. `guestbook` — profile comments as an old-web guestbook wall.
  9. `status_line` — one line "what i'm doing rn" + set time (`users.status_text`, `users.status_set_at`).
  10. `rap_sheet` — active warns and bans as "convictions"; **forced on** when the user has active warns/bans (cannot be hidden).
  11. `hit_counter` — 2003-style "you are visitor #000420" (`users.profile_views`, increment once per viewer per day).
  12. `sticker_board` — 3 sticker slots on the banner (shop stickers).
  13. `wanted_poster` — "WANTED" poster with username and debt; **auto-shown** when debt ≥ 1 000.

## 3. Aura shop

- Tables: `shop_items` is a code catalog (`src/shop/catalog.ts`: key, name, description, category, price, kind `permanent|consumable|timed`, payload); `user_inventory(user_id, item_key, quantity, acquired_at)`; `user_equipped(user_id, slot, item_key)`; `shop_purchases(id, user_id, item_key, price, created_at)` (audit + achievements).
- Purchase: one transaction — `UPDATE users SET aura = aura - price WHERE id = $1 AND aura >= price RETURNING` (no buying on credit; aura can still go negative via debt/fights), then inventory insert. Race-safe by the conditional update.
- Profile:
  - **nyan cat over nickname** (the only name effect): animated nyan cat with rainbow trail above the username; static under `prefers-reduced-motion`.
  - **profile accent colour**: curated palette near the project scheme (hot pink, magenta, acid pink, deep violet, cold red, rose), each checked for contrast on `#09090b`; no free HEX.
  - **profile backgrounds**: scanlines, starfield, "matrix but pink", static noise, grid — tinted by the profile accent colour.
  - **titles**: "certified yapper", "basement dweller", "debt collector", "touched grass once", more; equipped title replaces nothing admin-forced (`forcedTitle` still wins).
  - **verified chud**: parody pink check next to the name, tooltip "verified by nobody".
  - **hit counter**, **vine boom button** (plays a boom to whoever clicks it; click-only), **stickers** (soap, skull, "approved by killsquad", …; 3 banner slots).
- Chat: **name colour** (same curated palette), **name icon** (skull, soap, crown, clown), **quote style** for `>>id` references.
- Trolling consumables:
  - **clown stamp** — stamps "certified clown" on another profile for 24 h.
  - **rename curse** — another user's name shows with "(he/him/it/mogged)" for 1 h.
  - **aura tax** — a room you created gets "sponsored by @you" in its header for 24 h.
  - **spotlight** — pins your message at the top of a room for 10 min.
  - **room boost** — your room sits first in the lobby with a "promoted" tag for 1 h.
- Economy items:
  - **fight insurance** — next lost fight costs half the stake (consumed on use).
  - **debt forgiveness token** — clears 100 debt at a bad rate.
  - **mystery soap** — loot box with a random cosmetic; odds shown in the shop (common 70 / rare 25 / legendary 5).
- Shop UI: in-voice storefront ("the soap market"), categories as tabs, item cards with preview, price in aura, owned/equipped states; purchase confirm; mobile grid.

## 4. Economy mechanics

- **Aura stimulus check**: daily login bonus; streak multiplies (day 1: 10, +5 per streak day, cap 50); missed day → "stimulus revoked" toast and streak reset. `users.stimulus_streak`, `users.last_stimulus_at`.
- **Weekly leaderboard**: most aura, most in debt, most mogged (losses), computed weekly; page + top-3 badge in profiles.
- **Room notices**: system lines in a room when someone pays aura tax, spotlights a message or boosts the room ("@x paid the aura tax. bow.").
- Economy achievements (added to the Round 1 catalog): `whale` (10 000 aura spent), `scammed` (10 mystery soaps, nothing rare), `insurance fraud` (3 insured losses in a row), `sponsored content` (5 aura taxes).

## 5. Room themes

- Chosen at room creation (and by the creator later); `rooms.theme` (enum). One free (`basement`), the rest bought once per user (inventory) to unlock for their rooms.
- Themes are CSS-variable sets applied on the room page container only — same components, guaranteed layout-safe and mobile-safe:
  - `basement` (default, current look);
  - `fight_club` (dirty pink, soap texture, stencil heading; unlocked only for users who found the basement);
  - `vaporwave` (purple-pink gradient, palms, MS Gothic headings);
  - `corpo` (deliberately boring white office look, "per my last email" copy — contrast trolling);
  - `crime_scene` (black/yellow stripes like the warn ticker);
  - `win98` (grey windows, blue title bars, "OK" / "cringe" buttons);
  - `graveyard` (for dead rooms; messages as tombstones).

## 6. Calls made by Claude (check)

- Prices are set during planning (balanced against the default aura 1 000 and farm rate) and listed in the plan.
- Mystery soap odds 70/25/5.
- **Widgets vs shop:** all widgets are free except `hit_counter` and `sticker_board`, which unlock when the user owns the matching shop item; layout validation checks inventory for those two.
- **Trolling items are cosmetic overlays**, stored in `profile_effects(target_id, kind, applied_by, expires_at)`; a clown stamp does NOT set `isClown` and does not count for clown achievements. Can't target yourself or admins; one active effect of each kind per target; banned users can be targeted.
- **Fight insurance keeps fights zero-sum:** an insured loss moves half the stake in both directions (loser loses half, winner gains half), for aura and debt stakes alike.
- Title display precedence: admin `forcedTitle` > active fight title > equipped shop title (see Round 1 §7.1).
- Stimulus 10 → +5/day → cap 50.
- Widget layout stored per user as an ordered key list; `rap_sheet` and `wanted_poster` cannot be hidden when their condition holds.
