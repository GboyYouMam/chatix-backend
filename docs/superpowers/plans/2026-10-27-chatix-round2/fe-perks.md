# R2-FE-PERKS Room Themes, Perks, Stimulus & Leaderboard UI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 7 room themes (picker at creation + rendering), trolling item use flows, room notices, sponsored/boosted/spotlight UI, daily stimulus toast, leaderboard page.

**Spec/Contract:** spec §3–§5; overview "Economy & perks" contract (paths under `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\`).

### Task 1: Room themes (`feat(rooms): room themes`)
- `src/themes/roomThemes.ts`: `ROOM_THEMES: Record<ThemeKey, Record<string, string>>` — CSS variable sets (`--room-bg`, `--room-surface`, `--room-text`, `--room-muted`, `--room-accent`, `--room-border`, `--room-font-heading`, optional `--room-pattern`) for `basement` (current look), `fight_club` (dirty pink, soap/foam texture via radial gradients, stencil-ish heading with letter-spacing), `vaporwave` (purple→pink gradient, grid horizon, MS Gothic/monospace headings), `corpo` (white/grey office look, blue links, Arial, deliberately boring; in-room copy tweaks like "per my last email"), `crime_scene` (black + yellow/black tape stripes), `win98` (#c0c0c0 windows, navy title bars, bevelled buttons, "OK"/"cringe"), `graveyard` (dark grey, moss green accent, messages as tombstones with rounded tops).
- Room page applies the set on its root; components read `var(--room-*)` with fallbacks to global tokens. Body text contrast ≥ 4.5:1 in every theme (helper `contrastRatio(hexA, hexB)` + test over all themes — real risk: unreadable rooms). Check each at 375 px (Review Focus #5).
- Create/edit room modal: theme picker (swatches + names; locked ones show price and link to `/shop`; THEME_LOCKED toast).

### Task 2: Perks & notices (`feat(rooms): sponsored, boosted and spotlight rooms`)
- Lobby: boosted rooms first with a "promoted" pill; room header "sponsored by @x" when present; spotlight message pinned at top with a countdown.
- Use flows: on someone's profile — "clown stamp" / "rename curse" buttons (if owned; confirm modal); in your room — "aura tax", "room boost"; on your message — "spotlight". All via `POST /shop/use` with in-voice toasts.
- Render `effects` on profiles ("CERTIFIED CLOWN" stamp overlay; cursed name suffix "(he/him/it/mogged)") and `renameCursed` in chat.
- System messages (`kind: 'system'`) styled as centered muted lines; `roomNotice` toast.

### Task 3: Stimulus + leaderboard (`feat(economy): stimulus check and leaderboard`)
- On app start for logged-in users call `POST /economy/stimulus` once per UTC day (localStorage guard); granted → toast `stimulus check: +N aura. streak N.`; `streakReset` → `stimulus revoked. streak reset. touch grass less.`
- `/leaderboard` page: three columns/tabs (most aura / most in debt / most mogged), this week vs last week, top 3 with crown/skull/clown; link from rooms header.
- Lint/build/test; check 375 px; commit.
