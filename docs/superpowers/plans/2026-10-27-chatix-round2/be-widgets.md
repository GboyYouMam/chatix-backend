# R2-BE-WIDGETS Profile Widgets Backend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Widget layout, profile track (Spotify/SoundCloud), status line, aura history, profile views, and widget data on the profile payload.

**Spec/Contract:** spec §1–§2; overview "Widgets" contract.

### Task 1: Schema (`feat(widgets): layout, track, status, views and aura history schema`)
- `users`: `widget_layout jsonb default '["medal_rack","fight_record","debt_meter","guestbook"]'`, `profile_track_url varchar(300)`, `status_text varchar(80)`, `status_set_at`, `profile_views int default 0`; `aura_history(user_id fk, day date, aura int, PK(user_id, day))`; `profile_view_log(user_id, viewer_key varchar(80), day date, PK(user_id, viewer_key, day))`. Migration `0017_widgets`.

### Task 2: Track URL + extras (`feat(widgets): profile track and status line`)
- `src/widgets/track-url.ts`: `normalizeTrackUrl(raw: string): { provider: 'spotify'|'soundcloud'; canonical: string; embedUrl: string } | null` — parse with `new URL`, require `https:`, host exactly `open.spotify.com` (path `/(intl-[a-z-]+/)?(track|album|playlist)/<id>`) or `soundcloud.com`/`www.soundcloud.com`/`on.soundcloud.com`; strip query/hash; Spotify embed `https://open.spotify.com/embed/<type>/<id>?theme=0`; SoundCloud embed `https://w.soundcloud.com/player/?url=<encoded canonical>&color=%23fa4d98&auto_play=false&visual=false`. (Short `on.soundcloud.com` links: store as-is canonical; no network resolution.)
- Unit tests (real risk): `https://open.spotify.com.evil.com/track/x`, `javascript:alert(1)`, `http://open.spotify.com/...`, `https://evil.com/?u=open.spotify.com` → null (Review Focus #3); valid track/album/playlist and soundcloud URLs → correct embed.
- `PATCH /users/me/profile-extras` per contract.

### Task 3: Layout + data (`feat(widgets): widget layout and profile widget data`)
- `PATCH /users/me/widgets` per contract (validate keys, uniqueness, max 13; lock `hit_counter`/`sticker_board` on inventory).
- Aura history: on any aura change (farm, admin delta, fight settle, purchase) upsert today's row (`ON CONFLICT (user_id, day) DO UPDATE SET aura = EXCLUDED.aura`) — one helper `AuraHistoryService.record(userId, aura, tx?)`; plus backfill today's row for every user in the script `scripts/backfill-achievements.ts` or a new `scripts/backfill-aura-history.ts`.
- Profile views: on `GET /users/profile/:username` by someone other than the owner, insert into `profile_view_log` (viewer = userId or ipTag) `ON CONFLICT DO NOTHING` and increment `profile_views` only when inserted.
- Profile payload `widgets: { layout, data }` per contract; force-add `rap_sheet` when active warns/bans and `wanted_poster` when debt ≥ 1000. Compute data with bounded queries (30-day history, top 5, top 3 rooms).
- Tests: forced rap_sheet; views counted once per viewer per day; layout with unknown key → 400.
- Build + jest + e2e green; commit.
