# R2-BE-PERKS Economy & Perks Backend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Consumable use (clown stamp, rename curse, aura tax, spotlight, room boost, fight insurance, debt forgiveness), room themes, room notices, daily stimulus, weekly leaderboard.

**Spec/Contract:** spec §3–§5 + §6; overview "Economy & perks" contract. Builds on the merged shop (inventory, catalog).

### Task 1: Consumables (`feat(economy): use consumable items`)
- Schema: `profile_effects(id, target_id fk, kind, applied_by fk null, expires_at, created_at)` index `(target_id, kind, expires_at)`; `rooms`: `theme varchar(24) default 'basement'`, `sponsored_by uuid null`, `sponsored_until`, `boosted_until`, `spotlight_message_id uuid null`, `spotlight_until`; `messages.kind varchar(12) default 'user'`; `users.fight_insurance_armed boolean default false`. Migration `0016_economy_perks`.
- `POST /shop/use` per contract: in one transaction decrement inventory (`quantity - 1 WHERE quantity >= 1`, delete at 0) and apply the effect; validation errors per contract; clown/curse can't target self or admins; one active effect per kind per target (409 ALREADY_CURSED).
- Fight insurance: armed flag consumed on the next finished fight; insured loss settles half stake both ways; `fights.insured`.
- Debt forgiveness: `debt = debt - 100` atomically.
- Tests: two concurrent uses with quantity 1 → one succeeds (Review Focus #1); stamp on admin → 403; insured loss moves half; forgiveness reduces debt by 100 (debt may go negative).

### Task 2: Room perks + themes + notices (`feat(rooms): themes, boosts, sponsorship and spotlight`)
- Room payloads gain `theme`, `sponsoredBy`, `boostedUntil`, `spotlight`; lobby ordering: active boost first, then newest.
- `POST/PATCH /rooms` accept `theme` (owned or `basement`, else 403 THEME_LOCKED; `fight_club` also needs the achievement).
- On aura tax / spotlight / boost: insert a system message (`kind: 'system'`, text like `@x paid the aura tax. bow.`) and emit `roomNotice` + `newMessage` to the room.
- Tests: boosted room first in lobby; theme without ownership → 403; system message appears in history.

### Task 3: Stimulus + leaderboard (`feat(economy): daily stimulus and weekly leaderboard`)
- `users.stimulus_streak int default 0`, `users.last_stimulus_at timestamptz`.
- `POST /economy/stimulus` per contract (UTC days; atomic conditional update so a double call grants once).
- `GET /economy/leaderboard` per contract; "most mogged" = losses in `fights` that week; aura/debt = current values (top 10).
- Tests: second call same day grants 0 (Review Focus #4); missed day resets streak; leaderboard order.
- Build + jest + e2e green; commit.
