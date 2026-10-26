# FE-3 Admin Panel: Data Layer & Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Адмінка показує свіжі дані одразу після змін (без перезаходу), список не блимає і не ламає лейаут, live-оновлення з сокета; повний редизайн у стилі Chatix з тролінг-копірайтом; підтримка причини бану, зняття бану, автобан-бейджів.

**Architecture:** Фабрика ключів запитів; detail-запити лише з detail-ендпоінтів; мутації оновлюють кеш з відповіді; сокет `/admin` патчить кеш. Візуал — спільний `AdminLayout` + CSS Module на токенах проєкту.

**Tech Stack:** React 19, TypeScript, @tanstack/react-query 5, socket.io-client, CSS Modules. Нових залежностей немає.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-hardening-design.md` (§8, §9, §12). Global Constraints: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-hardening\00-overview.md`.

Репо: `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`. Гілка: `feat/admin-panel-redesign` від `feat/hardening` (після злиття FE-1).

**Consumes з FE-1:** `createSocket('/admin')`, `notify`, `queryClient`, `parseApiError`, правила чистих модулів і `npm test`. **Контракт бекенду (BE-3):** `AdminUserDto`, `AdminRoomDto`, `GET /admin/users/:id`, `GET /admin/rooms/:id`, modifiers з `null`/`auraDelta`/`debtDelta`/`banReason`, події `admin:user_updated { user | null, id? }`, `admin:room_updated { room }`, `admin:message_deleted { id }`, `newAdminLog`.

---

### Task 1: Шар даних адмінки

**Files:**
- Create: `src/hooks/admin/adminKeys.ts`, `src/components/admin/adminBadges.ts`, `tests/adminBadges.test.ts`
- Modify: `src/api/admin/admin.service.ts` (повертати `.data`), `src/api/admin/types.ts` (camelCase `AdminUser`, `AdminRoom` = DTO з BE-3), `src/hooks/admin/users/useAdminUser.ts`, `src/hooks/admin/users/useAdminUsers.ts`, `src/hooks/admin/rooms/useAdminRoom.ts`, `src/hooks/admin/rooms/useAdminRooms.ts`, `src/hooks/admin/useAdminMessages.ts`, `src/hooks/admin/useAdminWarnings.ts`, `src/hooks/admin/useAdminAuditLogs.ts`, `src/hooks/admin/useAdminSocket.ts`, `src/components/admin/actions/AdminUserQuickActions.tsx`, `src/components/admin/adminPanelUtils.ts`, `src/utils/adminQueryUtils.ts`, `src/pages/Admin/AdminUserPage.tsx:22-26`

**Interfaces:**
- Produces: `adminKeys = { all: ['admin'], users: (params?) => ['admin','users','list', params], user: (id) => ['admin','users','detail', id], rooms: (params?) => [...,'list',...], room: (id) => [...,'detail', id], messages: (params?) => ..., auditLogs: (params?) => ..., warnings: (userId, params?) => ... } as const` — list і detail у різних гілках ключа, щоб інвалідація списку не чіпала detail і навпаки.
- `useAdminUser(id)` / `useAdminRoom(id)` — лише `GET /admin/users/:id` / `/admin/rooms/:id`; видалити читання з кешу списку і фолбек `search: userId`; прибрати з `AdminUserPage` прихований `useAdminUsers({ enabled: false })`.
- Списки: `placeholderData: keepPreviousData`, `staleTime: 10_000`; повертають `{ items, total, isInitialLoading, isFetching }`.
- Мутації користувача/кімнати: `onSuccess(data)` → `setQueryData(adminKeys.user(id), data)` + `invalidateQueries({ queryKey: ['admin','users','list'] })`; `notify.success` / `notify.error`.
- Quick actions шлють `debtDelta` / `auraDelta`, а не абсолютні значення.
- `useAdminSocket`: `createSocket('/admin')`; `admin:user_updated` → `setQueryData` detail (або `removeQueries` при `user: null`) + інвалідація списку; `admin:room_updated` аналогічно; `admin:message_deleted` → інвалідація повідомлень; `newAdminLog` → додати в кеш аудит-логів (перша сторінка), не в локальний state. Без `joinAdminLogs`.
- Видалити `?? snake_case` фолбеки в `adminPanelUtils.ts`.
- Produces (`adminBadges.ts`, без імпортів): `getWarnBadge(count: number, threshold = 3): { label: string; level: 'clean' | 'warm' | 'hot' | 'cooked' }` → `0 → '[WARN 0/3]','clean'`, `1 → 'warm'`, `2 → 'hot'`, `≥3 → '[WARN 3/3]','cooked'` (label показує фактичне число, напр. `'[WARN 4/3]'`); `getUserBadges(u: { role; bannedUntil; isAutoBanned; isClown; isMogged }, now: number): string[]` → у порядку `ADMIN`, `AUTOBANNED` або `BANNED` (лише якщо `bannedUntil > now`), `CLOWN`, `MOGGED`.

- [ ] **Step 1: Тест** `tests/adminBadges.test.ts`: всі рівні `getWarnBadge`; забанений автобаном адмін-клоун → `['ADMIN','AUTOBANNED','CLOWN']`; бан у минулому → без `BANNED`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** `npm test` PASS; вручну (з BE-3): відкрити юзера, натиснути «+100 debt» двічі → борг +200 одразу на сторінці; у другій вкладці адмінки та сама зміна з'являється без перезавантаження; перехід між сторінками списку і пошук не показують «no results» під час завантаження.
- [ ] **Step 5: Commit** `fix(admin): fetch details from api and keep cache in sync` + `feat(admin): live updates from admin socket`.

### Task 2: Лейаут і візуальна система адмінки

**Files:**
- Create: `src/components/admin/AdminLayout.tsx`, `src/components/admin/AdminConfirmDialog.tsx`
- Modify: `src/pages/Admin/AdminPanel.module.css` (переписати), `src/components/admin/AdminPanelSidebar.tsx` (використати як навігацію), `src/components/admin/AdminEntityList.tsx`, `src/components/admin/AdminListPagination.tsx`, `src/components/admin/AdminSidebarSearch.tsx`, `src/components/admin/AdminAuditFeed.tsx`, `src/App.tsx` (адмін-маршрути через `AdminLayout` як `Outlet`-обгортку)
- Delete: `src/components/admin/actions/AdminLogActions.tsx`, `src/components/admin/actions/AdminLogActions.module.css`, невикористані класи `.adminLayout`/`.mainContent` старого вигляду

**Interfaces:**
- Візуальні правила (з §9 спеки): лише токени `src/index.css`; синя палітра (`#0b0f16`, `#111823`, `#4da6fa`) видаляється повністю (`grep -rn "4da6fa\|0b0f16\|111823" src` → порожньо); заголовок «CHATIX // KILLSQUAD» засічковим шрифтом з `letter-spacing: 4px` і рожевим світінням; панелі — `--surface`, `1px solid var(--border)`, радіус 8px, рожевий gradient top-border через `::before` (як `Duel.module.css:370-378`); цифри і логи — Courier New.
- `AdminLayout`: сайдбар (users / rooms / messages / audit, активний пункт рожевий) + контент; на < 768 px сайдбар стає горизонтальною смугою вкладок зверху.
- `AdminEntityList`: панель фіксованої висоти `min(70vh, 720px)` з власним скролом; скелетон-рядки при `isInitialLoading`; «no chuds found. lower the standards.» лише коли `!isFetching && items.length === 0`; тонкий індикатор `isFetching` зверху панелі; рядок користувача — аватар 28px, username (ellipsis), бейджі з `getUserBadges`, `getWarnBadge` з кольором за рівнем (`clean` muted, `warm` жовтуватий, `hot` `--primary`, `cooked` `--primary` з пульсацією), аура/борг справа моноширинним.
- `AdminConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel })` — модалка на токенах; для vaporize/бану/видалення: тексти на кшталт «vaporize this bum?», «this mf is about to be cooked», кнопка «do it» / «nah».
- `AdminAuditFeed` — «термінал»: чорний фон, Courier, рядки `[HH:MM:SS] admin → action → target`, нові записи плавно в'їжджають зверху; `prefers-reduced-motion` — без анімації.

- [ ] **Step 1:** Реалізувати лейаут, список, діалог, фід.
- [ ] **Step 2:** Вручну на 1440 px, 1024 px, 768 px, 375 px: немає горизонтального скролу сторінки; 25 рядків не розтягують сітку; адмінка візуально як частина Chatix (порівняти поряд з `/rooms` і `/lobby`).
- [ ] **Step 3:** `npm run lint`, `npm run build` → чисто.
- [ ] **Step 4: Commit** `feat(admin): redesign admin layout in chatix style` + `chore(admin): remove unused admin components`.

### Task 3: Сторінки користувача, кімнати, повідомлень

**Files:**
- Modify: `src/pages/Admin/AdminDashboard.tsx`, `src/pages/Admin/AdminUserPage.tsx`, `src/pages/Admin/AdminRoomPage.tsx`, `src/pages/Admin/AdminMessagesPage.tsx`, `src/components/admin/AdminWarningManager.tsx`, `src/components/admin/control/AdminTimeModifierControl.tsx`, `src/components/admin/control/AdminForcedTitleControl.tsx`, `src/components/admin/actions/AdminRoomActions.tsx`, `src/components/admin/actions/AdminMessageActions.tsx`, `src/components/admin/actions/AdminUserQuickActions.tsx`

**Interfaces:**
- Бан: контрол часу + поле «ban reason (be creative)» → `{ bannedUntil, banReason }`; кнопка «unban» → `{ bannedUntil: null }` (теж для `yapCooldown` — «let him yap»); `forcedTitle` — «clear» → `null`. Деструктивні дії через `AdminConfirmDialog`.
- Варни: список активних і відкликаних (відкликані — перекреслені, muted); форма «warn reason (be creative)»; відповідь `autoBanned: true` → `notify.info('3/3. this mf is cooked. autobanned for 7 days.')`; індикатор `getWarnBadge` біля заголовка; «revoke» з поясненням у тултипі, що бан не знімається.
- Шапка сторінки користувача: аватар, username, бейджі, `AUTOBANNED`-плашка з `banReason` і датою, аура/борг великими моноширинними цифрами.
- Сторінка кімнати: `hasPassword` замість пароля, карантин з підтвердженням, `messagesCount`.
- Копірайт кнопок/порожніх станів — lowercase тролінг у стилі проєкту; існуючі тогли «Mark as clown», «Brutally Mog him», «admin glaze mode» зберегти.

- [ ] **Step 1:** Реалізувати.
- [ ] **Step 2:** Вручну (з BE-3): видати 3 варни → тост автобану, бейдж `AUTOBANNED`, у вкладці користувача (інший браузер) одразу екран бану; «unban» → користувач після «try again, bum» повертається; vaporize з підтвердженням → користувач зникає зі списку в обох вкладках адмінки.
- [ ] **Step 3:** `npm run lint`, `npm run build`, `npm test` → чисто.
- [ ] **Step 4: Commit** `feat(admin): ban reasons, unban and autoban feedback` + `feat(admin): restyle user, room and message pages`.
