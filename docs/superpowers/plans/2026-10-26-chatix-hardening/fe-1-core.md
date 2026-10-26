# FE-1 Core: Errors, Toasts, Session, Sockets, Ban Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Фронтове ядро під новий контракт: розбір помилок API, нормальні тости, перевірка сесії через `/users/me`, обробка 401/403-BANNED, єдина фабрика сокетів з `auth.token`, app-рівневий user-сокет, фановий екран бану, пагінація чату, прибирання мертвого коду.

**Architecture:** Чиста логіка (розбір помилок, відлік бану, тексти) — в модулях без імпортів, тестується `node --test`. `queryClient` виноситься в модуль, щоб інтерцептор axios міг його чистити. `BanGate` над усіма маршрутами.

**Tech Stack:** React 19, Vite 8, TypeScript, @tanstack/react-query 5, zustand 5, axios, socket.io-client, react-hot-toast, CSS Modules. Нових залежностей немає.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-hardening-design.md` (§5 Фронт, §5 Тости, §12). Global Constraints: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\plans\2026-10-26-chatix-hardening\00-overview.md`.

Репо: `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend`. Гілка: `feat/session-toasts-ban-screen` від `feat/hardening`. Бек паралельно змінюється — працюй за контрактом §12 спеки; для ручної перевірки до злиття бекенду можна підмінити відповіді в DevTools.

**Тести фронту:** чисті модулі в `src/**` **без імпортів** (або лише з відносними імпортами інших чистих модулів з розширенням `.ts`), тести — `tests/*.test.ts` у стилі існуючого `tests/attachments.test.ts` (`node:assert/strict`). Додати в `package.json` скрипт `"test": "node --test tests/"`.

---

### Task 1: Розбір помилок і тости

**Files:**
- Create: `src/api/errors.ts`, `tests/errors.test.ts`, `src/lib/toast.ts`, `src/lib/queryClient.ts`
- Modify: `src/components/Provider.tsx`, `src/index.css` (токени тостів, якщо потрібні), `package.json`, і **всі** місця з прямим `toast(...)` / `toast.error(...)` (`grep -rln react-hot-toast src` — 15 файлів)

**Interfaces:**
- Produces: `interface ApiError { status: number | null; code: string | null; message: string; bannedUntil: string | null; banReason: string | null }`; `parseApiError(err: unknown): ApiError` — працює з об'єктом форми axios-помилки (`{ response?: { status, data } , message }`) без імпорту axios; `message` береться з `data.message` (рядок; масив → `join('; ')`), інакше мережевої помилки → `'server is cooked. try again later.'`, інакше `'something broke. not ur fault (probably).'`; ніколи не `'[object Object]'`.
- Produces: `notify.success(message: string, id?: string)`, `notify.error(errOrMessage: unknown, id?: string)` (через `parseApiError`, якщо не рядок), `notify.info(message, id?)` у `src/lib/toast.ts`; `id` за замовчуванням = текст повідомлення (дедуп).
- Produces: `queryClient` експорт з `src/lib/queryClient.ts`; `Provider` його використовує.
- `<Toaster>`: один на застосунок, `position="top-center"` (прибрати конфлікт `top-right` vs `toastOptions.position: 'bottom-right'`), `containerStyle={{ zIndex: 10000 }}`, стиль: фон `var(--surface)`, текст `var(--text)`, рамка `1px solid var(--border)`, ліва смуга/іконка `var(--primary)`, моноширинний шрифт, `duration: 3500`, `error.duration: 5000`.

- [ ] **Step 1: Тест** `tests/errors.test.ts`: `{ response: { status: 403, data: { code: 'BANNED', message: 'u banned, chud', bannedUntil: '2030-01-01T00:00:00.000Z', banReason: 'lol' } } }` → усі поля розібрані; `{ response: { status: 400, data: { message: ['a','b'] } } }` → `message: 'a; b'`; `{ message: 'Network Error' }` (без `response`) → `status: null`, `message: 'server is cooked. try again later.'`; `'oops'` → `message: 'something broke. not ur fault (probably).'`; `{ response: { status: 500, data: {} } }` → не `'[object Object]'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реалізувати; замінити всі прямі виклики `toast` на `notify` (тексти лишити як є, якщо вони вже в стилі проєкту).
- [ ] **Step 4:** `npm test` PASS; `npm run dev` — тост помилки логіну видно поверх усього, двічі поспіль однаковий — один тост.
- [ ] **Step 5: Commit** `feat(toasts): unify api error parsing and toast styling`.

### Task 2: Сесія: `/users/me`, 401, 403-BANNED, адмін-гард

**Files:**
- Modify: `src/store/authStore.ts`, `src/api/client.ts`, `src/components/ProtectedRouter.tsx`, `src/App.tsx`, `src/hooks/useAuth.ts`
- Create: `src/hooks/useSessionBootstrap.ts`

**Interfaces:**
- `authStore` додає: `ban: { bannedUntil: string | null; banReason: string | null } | null`, `setBan(ban)`, `clearBan()`, `sessionStatus: 'idle' | 'checking' | 'ready'`, `setSessionStatus(s)`; `persist.partialize` зберігає `token`, `user`, `ban`.
- Produces: `useSessionBootstrap(): void` — при монтуванні `App`, якщо є токен: `sessionStatus = 'checking'` → `GET /users/me` → `setUser` → `'ready'`; без токена — одразу `'ready'`.
- `client.ts` response-інтерцептор: 401 → `logout()`, `queryClient.clear()`, `window.location.assign(PATH.authAndUser.login)` якщо ми не на сторінці логіну; 403 з `code === 'BANNED'` → `setBan({ bannedUntil, banReason })`. Помилку далі пробрасувати.
- `useAuth` логін: 403 `BANNED` → `setBan` (без тосту помилки), інакше як зараз.
- `ProtectedRoute`: поки `sessionStatus !== 'ready'` — нейтральний лоадер (`loading ur aura...`); `requireAdmin` дивиться на свіжу роль.

- [ ] **Step 1:** Ручний сценарій (чисті функції тут не виділяються): у localStorage `chatix-auth` змінити `user.role` на `'admin'` → перезавантажити `/admin` → редірект на `/rooms` після `/users/me`.
- [ ] **Step 2:** Реалізувати.
- [ ] **Step 3:** Перевірити: прострочений токен → редірект на `/login`, кеш чистий (React Query Devtools або повторний вхід іншим юзером не бачить чужих даних).
- [ ] **Step 4:** `npm run lint`, `npm run build` → чисто.
- [ ] **Step 5: Commit** `feat(auth): revalidate session and handle 401 and ban responses`.

### Task 3: Фабрика сокетів і user-сокет

**Files:**
- Create: `src/lib/socket.ts`, `src/hooks/useUserSocket.ts`
- Modify: `src/hooks/rooms/useRoomSocket.ts`, `src/hooks/fight-club/useFightClubSocket.ts` (лише створення сокета), `src/hooks/admin/useAdminSocket.ts` (лише створення сокета і namespace `/admin`; решту логіки адмінки робить FE-3), `src/App.tsx`
- Delete: `src/hooks/useroomSocket.ts`

**Interfaces:**
- Produces: `createSocket(namespace: '/' | '/fight-club' | '/admin'): Socket` — URL `VITE_API_URL + (namespace === '/' ? '' : namespace)`, `auth: (cb) => cb({ token: useAuthStore.getState().token })` (функція, щоб реконект брав свіжий токен), `transports: ['websocket']`; слухач `exception` → якщо `code === 'BANNED'` → `setBan`, інакше `notify.error(message)`.
- Produces: `useUserSocket(): void` — монтується в `App` для залогіненого користувача; `'/'` namespace; `user:updated` → `queryClient.invalidateQueries({ queryKey: ['me'] })` і повторний `GET /users/me` → `setUser`; `user:banned` → `setBan(payload)`; при розлогіні сокет закривається.
- `useRoomSocket`: прибрати будь-який `sendMessage` еміт і `authorId`; додати обробку `messageDeleted { id }` (прибрати з кешу повідомлень кімнати) і `roomQuarantined { roomId, quarantined }` (тост `'this room got quarantined. read-only now.'` та інвалідація кімнати).

- [ ] **Step 1:** Ручна перевірка в DevTools → Network → WS: handshake кожного з трьох сокетів містить `auth.token` без `Bearer`.
- [ ] **Step 2:** Реалізувати.
- [ ] **Step 3:** Перевірити, що надсилання повідомлень (HTTP) і live-оновлення в кімнаті працюють.
- [ ] **Step 4:** lint/build чисто.
- [ ] **Step 5: Commit** `refactor(sockets): single socket factory with token auth` + `chore: remove dead room socket hook`.

### Task 4: Екран бану

**Files:**
- Create: `src/utils/banScreen.ts`, `tests/banScreen.test.ts`, `src/pages/Banned/Banned.tsx`, `src/pages/Banned/Banned.module.css`, `src/components/BanGate.tsx`
- Modify: `src/App.tsx`, `src/utils/pathList.ts` (`PATH.banned = '/banned'`)

**Interfaces:**
- Produces (`banScreen.ts`, без імпортів): `getBanCountdown(bannedUntil: string | null, now: number): { days: number; hours: number; minutes: number; seconds: number; expired: boolean; permanent: boolean }` (`null` → `permanent: true, expired: false`); `formatCountdown(c): string` → `'02d 03h 04m 05s'`; `BAN_TAUNTS: readonly string[]` (≥ 8, включно з «touch grass in the meantime», «ur aura is in the negatives now», «the mods have spoken. cry about it.»); `APPEAL_DENIALS: readonly string[]` (≥ 6, перший — «appeal denied lmao»); `pickNext(list, current): string` — наступний елемент по колу.
- `BanGate`: якщо `ban` у сторі і (`permanent` або не `expired`) — будь-який маршрут, крім `/banned`, → `<Navigate to="/banned" replace />`; `/banned` без бану → `/rooms`. Усі сокети закриваються, поки бан активний.
- `Banned.tsx` — повноекранний, за спекою §5: засічковий заголовок «U GOT COOKED» з рожевим світінням, причина (`banReason ?? 'no reason. the mods just felt like it.'`), живий відлік (`setInterval` 1 с), таунт міняється кожні 4 с, marquee-стрічка з таунтами, кнопка «appeal» перемикає `APPEAL_DENIALS`, кнопка «logout» (`logout()` + `clearBan()` + `queryClient.clear()` → `/login`), при `expired` — кнопка «try again, bum»: `GET /users/me` → успіх → `clearBan()` → `/rooms`; 403 `BANNED` → оновити бан і тост `'still cooked.'`. `prefers-reduced-motion` — без анімацій і marquee (статичний текст).

- [ ] **Step 1: Тест** `tests/banScreen.test.ts`: `getBanCountdown('2030-01-02T03:04:05.000Z', Date.parse('2030-01-01T00:00:00.000Z'))` → `{ days: 1, hours: 3, minutes: 4, seconds: 5, expired: false }`; минула дата → `expired: true` і нулі; `null` → `permanent: true`; `formatCountdown` для попереднього → `'01d 03h 04m 05s'`; `pickNext(['a','b'], 'b')` → `'a'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реалізувати.
- [ ] **Step 4:** `npm test` PASS; вручну: виставити `ban` у сторі → будь-який URL веде на `/banned`; відлік іде; кнопки працюють; ширина 375 px без горизонтального скролу.
- [ ] **Step 5: Commit** `feat(ban): add full-screen ban page and ban gate`.

### Task 5: Пагінація чату і кімнати з `hasPassword`

**Files:**
- Modify: `src/api/messages/messages.service.ts`, `src/api/messages/types.ts`, `src/api/rooms/types.ts`, `src/pages/Rooms/Room.tsx`, `src/components/rooms/RoomReplies.tsx`, `src/components/rooms/RoomCard.tsx`, `src/pages/Rooms/JoinRoom.tsx`, `src/pages/Rooms/Rooms.tsx`, хук, що завантажує повідомлення кімнати

**Interfaces:**
- `getMessages(roomId: string, params?: { before?: string; limit?: number }): Promise<{ items: Message[]; nextCursor: string | null }>`; у кімнаті — `useInfiniteQuery` з `getNextPageParam: last => last.nextCursor ?? undefined`; кнопка «load older (if u dare)» над списком, поки є `nextCursor`; нові повідомлення з сокета додаються в останню сторінку.
- Типи кімнат: `password` прибрати, `hasPassword: boolean`; UI замка/форми пароля — по `hasPassword`.
- `Rooms.tsx`: `useAuthStore()` без селектора → селектори; `refetch` як колбек створення → `invalidateQueries`.

- [ ] **Step 1:** Ручна перевірка на кімнаті з > 50 повідомленнями (після злиття BE-1 — на реальному беку; до — пропустити й позначити в описі гілки).
- [ ] **Step 2:** Реалізувати.
- [ ] **Step 3:** Перевірка: старіші підвантажуються без дублів, скрол не стрибає донизу при підвантаженні.
- [ ] **Step 4:** lint/build/test чисто.
- [ ] **Step 5: Commit** `feat(chat): paginate room messages` + `fix(rooms): use hasPassword instead of password`.

### Task 6: Прибирання

**Files:**
- Delete: `src/App.css` (переконатися, що ніде не імпортується)
- Modify: `src/store/fightClubStore.ts` (коментарі українською → англійською, лише коментарі)

- [ ] **Step 1:** `grep -rn "App.css" src` → порожньо; видалити.
- [ ] **Step 2:** `npm run lint`, `npm run build`, `npm test` → чисто.
- [ ] **Step 3: Commit** `chore: remove unused styles and tidy comments`.
