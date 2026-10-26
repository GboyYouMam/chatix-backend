# FE-2 Player UI: QTE, Lobby, Easter Egg, Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дуель — QTE лише з клавіатури (клік нічого не робить), стан матчу з сервера, захищені маршрути fight club, пасхалка входу через «lmao», стрічка активних варнів над банером профілю, фіксовані бокові банери.

**Architecture:** Рішення про клавішу, детектор потрійного кліку і форматування стрічки — чисті модулі з тестами. Компоненти лише рендерять.

**Tech Stack:** React 19, TypeScript, zustand, socket.io-client, CSS Modules. Нових залежностей немає.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-hardening-design.md` (§4 Фронт, §10, §12). Global Constraints: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-hardening\00-overview.md`.

Репо: `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`. Гілка: `feat/qte-easter-egg-profile` від `feat/hardening` (після злиття FE-1).

**Consumes з FE-1:** `createSocket('/fight-club')` (`src/lib/socket.ts`), `notify` (`src/lib/toast.ts`), `ProtectedRoute` з `sessionStatus`, скрипт `npm test` і правила чистих модулів (див. FE-1).

---

### Task 1: QTE-дуель

**Files:**
- Create: `src/hooks/fight-club/qteKey.ts`, `tests/qteKey.test.ts`
- Modify: `src/components/fight-club/DuelCommandDeck.tsx`, `src/pages/Fight-Club/Duel.module.css` (`:114-165`), `src/hooks/fight-club/useFightDuel.ts`, `src/hooks/fight-club/useFightLobby.ts:26-39`, `src/hooks/fight-club/useFightClubSocket.ts`, `src/store/fightClubStore.ts`, `src/api/fight-club/types.ts`, `src/pages/Fight-Club/Duel.tsx`

**Interfaces:**
- Produces (`qteKey.ts`, без імпортів): `toHitKey(e: { key: string; repeat: boolean; isTrusted: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }): string | null` — `null` якщо `repeat`, `!isTrusted`, будь-який модифікатор, або `key` не одна літера `A–Z` (регістр неважливий); інакше велика літера.
- Типи: `FightPrompt { promptId: string; key: string }`; `fight:start` → `{ matchId, prompt }`; `fight:update` → `{ matchId, hp: Record<string, number>; combo: Record<string, number>; prompt }`; `FightState` як у BE-2 (`matchId, title, status, role, you, opponent, stakeType, stakeAmount`); `fight:hit` шле `{ matchId, promptId, k }`; `fight:join` шле лише `{ matchId }`; `fight:create` — `{ title, stakeType, stakeAmount }`.
- `DuelCommandDeck`: рамка з літерою — `<div aria-live="polite">` без `onClick`/`role`/`tabIndex`; `cursor: default`; прибрати hover/active-ефекти, що натякають на клікабельність. Під рамкою підказка `keyboard only. no clicking, chud.`.
- `useFightDuel`: `keydown` на `window` → `toHitKey` → еміт з поточним `promptId`; стан стану (stun) — лише для візуалу, не блокує клієнтську логіку більше, ніж сервер.
- Дані дуелі (суперник, ставка, роль) — тільки з `fight:state`; з URL читається лише `matchId`; лобі навігує на `/duel?matchId=<id>`.

- [ ] **Step 1: Тест** `tests/qteKey.test.ts`: `{ key: 'a', ... }` → `'A'`; `repeat: true` → `null`; `isTrusted: false` → `null`; `ctrlKey: true` → `null`; `key: 'Enter'` → `null`; `key: '1'` → `null`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** `npm test` PASS; вручну двома браузерами (звичайний + інкогніто): клік/тап по рамці — жодного WS-кадру `fight:hit` у DevTools; затиснута клавіша — один удар; підміна `stakeAmount` в URL нічого не змінює.
- [ ] **Step 5: Commit** `fix(fight-club): keyboard-only qte and server-driven duel state`.

### Task 2: Маршрути fight club

**Files:**
- Modify: `src/App.tsx:29-42`

- [ ] **Step 1:** Перенести `/lobby` і `/duel` під `ProtectedRoute`.
- [ ] **Step 2:** Перевірити: розлогінений на `/lobby` → `/login`.
- [ ] **Step 3: Commit** `fix(routes): require login for fight club`.

### Task 3: Пасхалка «lmao»

**Files:**
- Create: `src/utils/easterEgg.ts`, `tests/easterEgg.test.ts`
- Modify: `src/pages/Rooms/Rooms.tsx:114-131`, `src/pages/Rooms/Rooms.module.css`

**Interfaces:**
- Produces (`easterEgg.ts`, без імпортів): `createTripleClickDetector(windowMs = 1500, count = 3): (now: number) => boolean` — `true` на `count`-му кліку в межах `windowMs` від першого з серії, після чого серія скидається; `isSecretQuery(q: string): boolean` — `q.trim().toLowerCase() === 'first rule'`.
- Rooms: декоративний «lmao» лишається візуально таким самим (жодних підказок, курсор звичайний, без `button`-стилю; доступність — `aria-hidden`); `onClick` → детектор; пошуковий інпут → `isSecretQuery`. Спрацювання: залогінений — клас глітчу на 600 мс (рожевий RGB-split/shake, CSS `@keyframes`; з `prefers-reduced-motion` — без анімації), `notify.info("we don't talk about it.")`, `navigate('/lobby')`; незалогінений — `notify.error('login first, chud')` → `/login`.

- [ ] **Step 1: Тест:** кліки на 0, 500, 1400 → третій `true`; 0, 500, 1600 → `false`; після спрацювання наступні 2 кліки → `false`; `isSecretQuery('  First Rule ')` → `true`, `'first rules'` → `false`.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS; вручну обидва тригери.
- [ ] **Step 5: Commit** `feat(rooms): hidden fight club easter egg`.

### Task 4: Стрічка варнів у профілі

**Files:**
- Create: `src/components/profile/warningTicker.ts`, `tests/warningTicker.test.ts`, `src/components/profile/WarningTicker.tsx`, `src/components/profile/WarningTicker.module.css`
- Modify: `src/api/users/types.ts` (`activeWarnings: { reason: string; createdAt: string }[]`), `src/pages/Profile/Profile.tsx` (над верхнім банером)

**Interfaces:**
- Produces (`warningTicker.ts`, без імпортів): `formatWarningTicker(warnings: { reason: string }[], threshold = 3): string[]` → `['⚠ WARN 1/3: <reason>', ...]` у порядку з API; порожній масив для `[]`.
- `WarningTicker({ warnings })`: `null`, якщо порожньо; інакше стрічка «поліцейська огорожа»: діагональні чорно-рожеві смуги (`repeating-linear-gradient` з `--bg` / `--primary`), Courier New uppercase, безшовний marquee (контент дублюється двічі, `translateX(-50%)`, тривалість пропорційна довжині тексту), пауза на hover; `prefers-reduced-motion` — статично з `overflow-x: auto`. Повна ширина над верхнім банером, висота ~32px.

- [ ] **Step 1: Тест:** два варни → `['⚠ WARN 1/3: spam', '⚠ WARN 2/3: being a chud']`; `[]` → `[]`.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS; вручну профіль з 0 і з 2 варнами, ширина 375 px.
- [ ] **Step 5: Commit** `feat(profile): show active warnings ticker`.

### Task 5: Бокові банери фіксованого розміру

**Files:**
- Modify: `src/components/profile/ProfileSidebar.module.css:29-50`, `src/pages/Profile/EditProfile.module.css:160-170`, за потреби `src/pages/Profile/Profile.module.css` (сітка)

**Interfaces:**
- `.verticalBanner`: `width: 100%; max-width: 220px; max-height: 640px; aspect-ratio: 11 / 32; position: sticky; top: 16px; overflow: hidden`; `.bannerImage`: `width: 100%; height: 100%; object-fit: cover`. Колонка сайдбару — фіксованої ширини в сітці профілю (не `1fr`, що росте). `.sideBannerSize` у `EditProfile` — ті самі пропорції. На ширині < 900 px бокові банери ховаються (як зараз, або додати, якщо зараз не ховаються).

- [ ] **Step 1:** Вручну: профіль з довгими коментарями (сторінка висока) і зі зображенням 400×3000 — банери не довші за 640 px, лишаються видимими при скролі.
- [ ] **Step 2:** Реалізувати.
- [ ] **Step 3:** `npm run lint`, `npm run build`, `npm test` → чисто.
- [ ] **Step 4: Commit** `fix(profile): cap side banner size`.
