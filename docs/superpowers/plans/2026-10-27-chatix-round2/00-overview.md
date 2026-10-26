# Chatix Round 2 — Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each worker executes **only its own plan file**; this file's Global Constraints, Catalog and Contract apply to everyone.

**Goal:** Aura shop with cosmetics, trolling consumables and economy items; room themes; 13 profile widgets incl. Spotify/SoundCloud; daily aura stimulus; weekly leaderboard; room notices.

**Architecture:** Backend: a `shop` module (catalog in code, inventory/equipped/purchases tables, atomic purchase), an `economy` module (stimulus, leaderboard, profile effects, room perks), a `widgets` module (layout, track url, aura history, profile views, widget data). Frontend: shop page + cosmetics renderer, widgets grid + editor, room themes + perks UI.

**Tech Stack:** NestJS 11, drizzle-orm, jest/supertest; React 19, react-query 5, CSS Modules, `node --test`.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round2-design.md` (+ Round 1 spec §0 ground rules).

## Workers (Claude Haiku subagents), branches, order

Integration branch `feat/round2` in each repo, from `feat/round1`. Each worker works in its own git worktree under `C:\Users\zakhar\chatix-wt\<branch-dir>` created by Claude.

| Phase | Worker | Repo | Plan | Branch |
|---|---|---|---|---|
| 1 | R2-BE-SHOP | backend | `be-shop.md` | `feat/aura-shop-backend` |
| 1 | R2-FE-SHOP | frontend | `fe-shop.md` | `feat/aura-shop-ui` |
| 2 | R2-BE-PERKS | backend | `be-perks.md` | `feat/economy-perks-backend` |
| 2 | R2-BE-WIDGETS | backend | `be-widgets.md` | `feat/profile-widgets-backend` |
| 2 | R2-FE-PERKS | frontend | `fe-perks.md` | `feat/room-themes-perks-ui` |
| 2 | R2-FE-WIDGETS | frontend | `fe-widgets.md` | `feat/profile-widgets-ui` |

Phase 2 starts after phase 1 is merged (perks and widgets build on the shop's inventory). Claude merges, resolves conflicts and regenerates migrations (`0015_shop`, `0016_economy_perks`, `0017_widgets`).

## Global Constraints

- **Roflo style** for every screen, toast, empty state, error, item name and description: lowercase, trolling/brainrot ("chud", "mogged", "cooked", "aura", "king"), tokens from `src/index.css` (`--bg`, `--surface`, `--primary #fa4d98`, `--text`, `--muted`, `--border`, `--danger`, `--warn`), serif headings with letter-spacing, Courier New for numbers/mono. No neutral/corporate UI.
- **English only. Mobile-first** (375 px, no horizontal scroll, tap targets ≥ 40 px).
- **Colours stay near the scheme:** the accent palette below is the only set of profile/name colours; no free HEX input anywhere.
- **Tests only for real risk:** purchases/aura math, races (double purchase, concurrent consumables), validation of track URLs, layout validation. No mock-mirroring tests.
- **No new dependencies** in either repo.
- **Git:** identity already configured (GboyYouMam) — never change it; Conventional Commits `<type>(<scope>): <desc>`; ≥ 1 commit per plan task; no Co-Authored-By/AI trailers; never push/merge/rebase/reset; never commit `.env`.
- **Done:** backend `npm run build`, `npx jest --runInBand`, `npm run test:e2e -- --runInBand` (own test DB given in the brief) green; frontend `npm run lint`, `npm run build`, `npm test` green.

## Catalog (single source of truth — backend `src/shop/catalog.ts`, prices in aura)

Accent palette keys (shared by profile accent and chat name colour): `hot_pink #fa4d98`, `magenta #e11d74`, `acid_pink #ff4fd8`, `deep_violet #7c3aed`, `cold_red #ef3b5c`, `rose #fb7185`. Default = `hot_pink` (free).

| key | category | kind | price | notes |
|---|---|---|---|---|
| `nyan_cat` | profile | permanent | 2500 | nyan cat flying above the nickname |
| `accent_<palette>` (5, not hot_pink) | profile | permanent | 400 | profile accent colour |
| `bg_scanlines`, `bg_starfield`, `bg_matrix_pink`, `bg_static`, `bg_grid` | profile | permanent | 600 | tinted by accent |
| `title_certified_yapper`, `title_basement_dweller`, `title_debt_collector`, `title_touched_grass_once`, `title_aura_merchant` | profile | permanent | 300 | equip one |
| `verified_chud` | profile | permanent | 1500 | pink check, tooltip "verified by nobody" |
| `hit_counter` | profile | permanent | 200 | unlocks the hit_counter widget |
| `vine_boom` | profile | permanent | 350 | boom button on profile |
| `sticker_soap`, `sticker_skull`, `sticker_killsquad`, `sticker_clown`, `sticker_crown` | profile | permanent | 150 | 3 banner slots; owning any unlocks sticker_board |
| `namecolor_<palette>` (6) | chat | permanent | 300 | chat name colour |
| `nameicon_skull`, `nameicon_soap`, `nameicon_crown`, `nameicon_clown` | chat | permanent | 250 | icon before name in chat |
| `quote_neon`, `quote_greentext`, `quote_redacted` | chat | permanent | 200 | style of `>>id` quotes |
| `clown_stamp` | troll | consumable | 120 | "certified clown" on a profile for 24 h |
| `rename_curse` | troll | consumable | 150 | name shows "(he/him/it/mogged)" for 1 h |
| `aura_tax` | troll | consumable | 500 | "sponsored by @you" on your room for 24 h |
| `spotlight` | troll | consumable | 200 | pin your message on top of a room for 10 min |
| `room_boost` | troll | consumable | 400 | your room first in lobby with "promoted" for 1 h |
| `fight_insurance` | economy | consumable | 250 | next lost fight costs half (zero-sum: winner gets half) |
| `debt_forgiveness` | economy | consumable | 300 | clears 100 debt on use |
| `mystery_soap` | economy | consumable | 180 | random cosmetic: common 70 / rare 25 / legendary 5 (pools: common = stickers + quotes + titles, rare = backgrounds + name icons + accents + name colours, legendary = nyan_cat + verified_chud); duplicate → refund 50% |
| `theme_vaporwave`, `theme_corpo`, `theme_crime_scene`, `theme_win98`, `theme_graveyard` | theme | permanent | 800 | room themes for rooms you create |
| `theme_fight_club` | theme | permanent | 1200 | requires `found_the_basement` achievement |

Free: `theme_basement`, accent `hot_pink`.

## Contract

**Shop (R2-BE-SHOP)**
- `GET /shop/catalog` (public) → `[{ key, name, description, category, kind, price, rarity?, requires? }]` (names/descriptions in roflo voice).
- `GET /shop/me` (auth) → `{ aura, inventory: [{ itemKey, quantity }], equipped: { accent, background, title, nameColor, nameIcon, quoteStyle, nyanCat: boolean, verified: boolean, stickers: [string|null, string|null, string|null] } }`.
- `POST /shop/purchase { itemKey }` → `{ aura, inventory, granted?: string /* mystery soap result */, refunded?: number }`. Not enough aura → `400 { code: 'BROKE', message: 'u broke. go farm.' }`. Owning a permanent item → `409 { code: 'ALREADY_OWNED' }`. Requirement missing → `403 { code: 'LOCKED' }`.
- `PATCH /shop/equip { slot, itemKey | null }`, slots: `accent|background|title|nameColor|nameIcon|quoteStyle|nyanCat|verified|sticker1|sticker2|sticker3`; must own the item (or free default).
- Public cosmetics on profile (`GET /users/profile/:username` adds `cosmetics: { accent, background, title, nameColor, nameIcon, quoteStyle, nyanCat, verified, stickers }`, resolved to colour HEX / keys) and on message authors (`author.cosmetics: { nameColor, nameIcon, quoteStyle }`).
- Title precedence: admin `forcedTitle` > active `fightTitle` > equipped shop title.

**Economy & perks (R2-BE-PERKS)**
- `POST /shop/use { itemKey, targetUserId?, roomId?, messageId? }` for consumables: clown_stamp/rename_curse need `targetUserId` (not self, not admin; one active effect of each kind per target → `409 { code: 'ALREADY_CURSED' }`); aura_tax/room_boost need `roomId` of a room you created (live); spotlight needs `messageId` of your own message in a live room; fight_insurance arms your next fight; debt_forgiveness applies immediately.
- Profile adds `effects: [{ kind: 'clown_stamp'|'rename_curse', expiresAt, appliedBy: { username } }]`; message author adds `renameCursed: boolean`.
- Rooms add `theme`, `sponsoredBy: { username } | null`, `boostedUntil`, `spotlight: { message, expiresAt } | null`; lobby sorts boosted rooms first.
- `POST /rooms` / `PATCH /rooms/:id` accept `theme` (must own it unless `basement`) → `403 { code: 'THEME_LOCKED' }`.
- Room notices: socket `roomNotice { roomId, text, kind }` + persisted system lines in the thread (`messages.kind = 'system'`).
- Stimulus: `POST /economy/stimulus` (auth) → `{ granted, amount, streak, nextAt }`; first call of a UTC day grants `min(10 + 5*(streak-1), 50)`; a missed day resets streak (response `streakReset: true` → toast "stimulus revoked").
- Leaderboard: `GET /economy/leaderboard?week=current|previous` → `{ week, mostAura: [...10], mostDebt: [...10], mostMogged: [...10] }` (users with username, avatar, value). Weeks are Monday 00:00 UTC.
- Fight insurance: zero-sum half stake on an insured loss; `fights.insured = true`.

**Widgets (R2-BE-WIDGETS)**
- Widget keys: `now_playing, medal_rack, aura_chart, fight_record, top_glazers, debt_meter, yap_stats, guestbook, status_line, rap_sheet, hit_counter, sticker_board, wanted_poster`.
- `PATCH /users/me/widgets { layout: string[] }` (unique known keys; `hit_counter`/`sticker_board` require owning the item → 403 `WIDGET_LOCKED`).
- `PATCH /users/me/profile-extras { trackUrl?: string|null, statusText?: string|null }` — trackUrl validation per spec §1 → 400 "spotify or soundcloud links only, chud."; status ≤ 80 chars.
- `GET /users/profile/:username` adds `widgets: { layout: string[] (with forced rap_sheet/wanted_poster when applicable), data: { nowPlaying: { provider: 'spotify'|'soundcloud', embedUrl } | null, auraChart: [{ day, aura }] (30 days), fightRecord: { wins, losses, streak, last: { opponent, won, at } | null }, topGlazers: [{ username, pfp_url }] (5), debt: number, yapStats: { messages, topRooms: [{ title, count }], mostCookedTake: { excerpt, replies } | null }, status: { text, setAt } | null, rapSheet: { warns: [...], bans: [...] }, hitCount: number } }`.
- Profile views: increment once per viewer (user id or ip tag) per UTC day.
- Aura history: daily snapshot table, written on first aura change of the day and by a daily job.

## Review Focus

1. **Double purchase / double use under concurrency** (two clicks) → one charge, one item use. Tests in R2-BE-SHOP Task 2 and R2-BE-PERKS Task 1.
2. **Buying with exactly enough aura** succeeds; 1 aura short fails with BROKE and no charge. R2-BE-SHOP Task 2.
3. **Track URL spoofing** (`open.spotify.com.evil.com`, `javascript:`) rejected. R2-BE-WIDGETS Task 2.
4. **Stimulus twice in one UTC day** → second call grants 0. R2-BE-PERKS Task 3.
5. **Room theme on mobile**: every theme readable at 375 px, contrast AA for body text. R2-FE-PERKS Task 1 (manual).
