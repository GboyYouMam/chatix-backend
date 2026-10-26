# R2-FE-WIDGETS Profile Widgets UI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Widgets grid on the profile (13 widgets incl. Spotify/SoundCloud player) and a widget editor in edit profile.

**Spec/Contract:** spec §1–§2; overview "Widgets" contract (paths under `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\`).

### Task 1: Grid + editor (`feat(widgets): profile widget grid and editor`)
- `src/components/widgets/WidgetGrid.tsx`: 2 columns (1 column ≤ 600 px) under the profile card, renders `widgets.layout` in order; each widget is a panel with serif title + in-voice subtitle, accent from `--profile-accent` if present.
- Edit profile "widgets" section: toggle + reorder (up/down buttons — no drag lib), locked widgets show "buy in the soap market"; `rap_sheet`/`wanted_poster` shown as "forced on (u earned it)" when forced; save → `PATCH /users/me/widgets`.
- Track + status inputs → `PATCH /users/me/profile-extras` (server message on invalid URL).
- Pure helper `moveItem(list, index, dir)` + test.

### Task 2: Widgets (`feat(widgets): thirteen profile widgets`)
- `now_playing`: iframe from `embedUrl` (Spotify height 152, SoundCloud 166), `loading="lazy"`, `allow="encrypted-media"`, title "currently rotting to"; nothing when no track.
- `medal_rack`: reuse `MedalRack`.
- `aura_chart`: inline SVG sparkline (no chart lib), ticker header `$AURA ▲/▼ x% today. bullish/bearish`.
- `fight_record`: W/L big mono, streak, "last seen getting mogged by @x" / "last seen mogging @x".
- `top_glazers`: 5 avatars + names.
- `debt_meter`: bar "financially cooked: N%" (debt / 1000 capped at 100%), negative → "financial cushion: secured".
- `yap_stats`: messages, top rooms, "most cooked take" excerpt.
- `guestbook`: profile comments styled as an old-web guestbook (move the existing comments section into it when the widget is on; keep comments working).
- `status_line`: text + relative time.
- `rap_sheet`: warns/bans as "convictions" (mugshot-style card).
- `hit_counter`: 7-digit odometer "you are visitor #000420".
- `sticker_board`: shows owned stickers wall.
- `wanted_poster`: sepia "WANTED" poster with avatar, username, "reward: N aura of debt".
- Pure helpers + tests: `auraTrend(points) → { pct, direction }`, `debtPercent(debt)`, `padVisitor(n)`.
- Check 375 px; lint/build/test; commit.
