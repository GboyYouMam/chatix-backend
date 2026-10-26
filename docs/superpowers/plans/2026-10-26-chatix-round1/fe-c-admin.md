# FE-C Admin Panel v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A genuinely great-looking, useful admin panel in the Chatix roflo style: human-readable audit sentences, dashboard with stats and moderation queue, user dossier with tabs, room and message pages — no raw UUIDs anywhere.

**Architecture:** Shared admin UI primitives (Panel, Button, StatTile, Tabs, DataCard, CopyId) with co-located CSS modules replacing the 827-line `AdminPanel.module.css`; data hooks on `adminKeys`; pure formatters for audit sentences.

**Tech Stack:** React 19, react-query 5, CSS Modules, `node --test`.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-round1-design.md` §6. Global Constraints + Contract (Admin, Rooms, Messages): `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-round1\00-overview.md`.

Repo `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`, branch `feat/admin-panel-v2` from `feat/round1` (after FE-A merged; rebase after FE-B). Backend lands in parallel (BE-B) — code against the Contract.

**Design direction (roflo, premium):** near-black panels with 1px `--border`, pink gradient top-edge on primary panels, serif section titles with letter-spacing, Courier for numbers/logs, subtle scanline texture on the dashboard header, in-voice micro-copy ("the killsquad terminal", "who needs touching grass today"), status colours from tokens only. Dense but breathable; every list row has avatar + name, never an id.

---

### Task 1: Primitives, layout, formatters

**Files:** Create `src/components/admin/ui/{Panel,Button,StatTile,Tabs,DataCard,CopyId,Avatar}.tsx` + `.module.css`; split `src/pages/Admin/AdminPanel.module.css` into co-located modules and delete it; Create `src/components/admin/auditSentence.ts`, `tests/auditSentence.test.ts`.

**Interfaces:** `auditSentence(item: AuditItem): { actor: string; verb: string; target: string; detail: string | null }` (pure) for every Contract `actionKey`, e.g. `user.ban` → `{ actor: 'jes95us', verb: 'banned', target: 'tester777', detail: 'for 3 min — "ur eyeline…"' }`, `user.modifiers` aura diff → `detail: 'aura 1000 → 950'`; unknown/legacy → generic `did something to`.
- [ ] **Step 1: Test** `auditSentence.test.ts` for ban (with duration from before/after), warn, modifiers diff, room.reject with reason, legacy.
- [ ] **Step 2–4** → **Step 5: Commit** `refactor(admin): ui primitives and co-located styles` + `feat(admin): human-readable audit sentences`.

### Task 2: Dashboard

**Files:** `src/pages/Admin/AdminDashboard.tsx`, hooks `useAdminStats`, `useModerationQueue`, `useAdminAuditLogs` (filters).
- Stat tiles (rooms in review, active bans, warns today, autobans this week).
- Moderation queue: room cards (title, creator avatar+name, topic, created) with approve / reject (reason modal) / quarantine.
- Live audit feed using `auditSentence`, filters (admin, action, target type, success), "load more".
- [ ] **Step 1:** implement; live updates via `useAdminSocket` (`admin:room_updated`, `newAdminLog`). - [ ] **Step 2: Commit** `feat(admin): dashboard with stats, moderation queue and audit feed`.

### Task 3: User dossier

**Files:** `src/pages/Admin/AdminUserPage.tsx` split into `components/admin/user/{DossierHeader,ModerationTab,WarningsTab,HistoryTab,MessagesTab}.tsx`; hook `useAdminUserActions` (all mutations).
- Header: avatar, username, role, badges, big mono aura/debt, ban state + live countdown + reason, `[WARN n/3]` meter, IP history (`GET /admin/users/:id/ips`, full IPs — admins only).
- Moderation tab: grouped actions — ban (duration presets 10 min / 1 h / 24 h / 7 d / custom + reason), unban, yap cooldown, warn, clown/mog/glaze toggles, forced title, aura/debt deltas, profile lock, vaporize (confirm).
- Warnings tab (active/revoked), History tab (audit filtered by this user as target, sentences), Messages tab (room title + excerpt + time + delete).
- State reset by `key={userId}` (remove the paging hack).
- [ ] **Step 1:** implement. - [ ] **Step 2: Commit** `feat(admin): user dossier with tabs`.

### Task 4: Rooms, messages, mobile, cleanup

**Files:** `AdminRoomPage.tsx`, `AdminMessagesPage.tsx`, users/rooms lists.
- Room page: status pill + approve/reject/quarantine/ban/restore, creator, counts, recent messages.
- Messages page: author + room title + excerpt + time, filter by room/user, delete with confirm.
- Lists: avatar + name rows; ids only via `CopyId`.
- Mobile: sidebar → top tabs (exists), tables → cards, actions in a bottom sheet ≤ 600 px.
- Grep: no `id.slice(` / raw uuid rendering left in admin components.
- [ ] **Step 1:** implement + check at 375 px. - [ ] **Step 2: Commit** `feat(admin): room and message pages without raw ids` + `feat(admin): mobile layout`.
