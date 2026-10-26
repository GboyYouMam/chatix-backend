# Chatix: anti-cheat, безпека, логи, адмінка, пасхалка — дизайн

Дата: 2026-10-26
Репозиторії:
- бек: `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend` (NestJS 11, drizzle + postgres, socket.io, minio)
- фронт: `C:\Users\zakhar\WebstormProjects\chatix-frontend\chatix-frontend` (React 19, Vite, react-query, zustand, CSS Modules)

## 1. Навіщо

Chatix — чат з edge/тролінг-вайбом і міні-грою fight club, де ставиться аура/борг. Зараз:
- у fight club можна вигравати без скілу (клік по рамці завжди шле правильну літеру, затиснута клавіша спамить удари);
- бекенд має дірки в автентифікації (сокет чату без auth, роль і бан беруться з токена на 7 днів, адмінський сокет фактично не захищений);
- логування майже немає;
- адмінка показує застарілі дані, криво рендерить список і візуально випадає зі стилю проєкту;
- у fight club можна потрапити лише вручну ввівши `/lobby`.

Успіх = чесна гра, закриті дірки, логи, по яких реально можна розібратися в інциденті, адмінка, якою приємно користуватися, і пасхалка, яку знаходять «свої».

## 2. Цілі / не-цілі / анти-цілі

**Цілі** — див. розділи 4–11.

**Не-цілі**
- Ліміт на `POST /users/farm-aura` — **безліміт це фіча**, не чіпаємо (але гонку read-then-write прибираємо атомарним інкрементом).
- Refresh-токени, мультиінстанс fight club (Redis), повний редизайн не-адмінських сторінок.
- Сервер, що повністю унеможливлює ботів: будь-що, що отримує клієнт, можна автоматизувати. Мета — прибрати тривіальні чити і зробити бот невигідним.

**Анти-цілі (провал, навіть якщо «працює»)**
- Адмінка в «корпоративному» стилі, що не схожа на решту Chatix.
- Пасхалка у вигляді явної кнопки/лінки в меню.
- Зламані існуючі флоу: логін, чат, файли в повідомленнях, профіль, дуель.
- Логи, в які потрапляють паролі, JWT або вміст файлів.

## 3. Виконання

- Воркери: **Codex з моделлю `codex-6-luna`**, через **Orca**, кожен у своєму git worktree/гілці. Рев'ю кожної гілки робить Claude (грамотність, відповідність цьому документу, антипатерни, безпека, JWT).
- Бек і фронт — різні репо; контракт між ними зафіксовано в розділі 12, щоб їх можна було робити паралельно.
- Перед стартом воркерів незакомічені зміни користувача (міграції 0009/0010, journal, `package.json`, `README.md`, `docker-compose.yml`, `.env.example` в обох репо) комітяться в `main` — нові міграції нумеруються після 0010.
- Нові залежності дозволені тільки ті, що названі в цьому документі.

## 4. Fight club — anti-cheat і баги (бек + фронт)

### Механіка (уточнено користувачем)
Це **QTE**: єдиний спосіб бити — натиснути на клавіатурі літеру, що висвічується. Мишею/тапом вдарити **не можна взагалі**: рамка з літерою — чисто візуальний елемент, без `onClick`, не `<button>`, не фокусується.

### Сервер
- На кожен промпт сервер генерує `promptId` (crypto-random, одноразовий) і випадкову літеру, фіксує `promptSentAt`.
- `fight:start` / `fight:update` віддають `prompt: { promptId, key }` замість голого `nextKey`/`firstKey`.
- `fight:hit` приймає `{ matchId, promptId, k }` (валідований DTO). Відхиляти, якщо:
  - сокет не належить гравцю цього матчу (`client.id` ≠ socketId гравця або userId з токена не той);
  - `promptId` не поточний або вже використаний;
  - минуло < **120 мс** від `promptSentAt` (людська реакція) — рахується як промах;
  - гравець у стані.
- Неправильна `k` → стан 1 с, як зараз.
- Трекінг каденсу: якщо 10 поспіль влучань мають стандартне відхилення інтервалу < 15 мс — лог `warn` з подією `fight.suspicious_cadence` (без автопокарання).
- Баги:
  - `fight:join` на неіснуючий `matchId` — помилка, а не створення матчу;
  - життєвий цикл челенджу прив'язаний до **userId**, а не до сокета: лобі і дуель можуть мати різні сокети; при `fight:join` socketId гравця оновлюється на сокет дуелі; при дисконекті LOBBY-матч видаляється лише якщо у творця не лишилось жодного сокета в namespace протягом **10 с** (grace period); у статусі FIGHTING дисконект → rage_quit, як зараз;
  - ставки: **аура і борг можуть іти в мінус** (рішення користувача) — перевірки балансу не додаємо, нічого не клампимо; правила ставок лишаються як зараз, лише розрахунок через атомарні `sql` інкременти в транзакції;
  - якщо транзакція результату падає — гравцям іде `fight:error` з поясненням, матч не зникає мовчки;
  - новий подія `fight:state` (відповідь на `fight:join`) з даними матчу (суперник, ставка, роль) — фронт бере їх звідси, **а не з URL**.

### Фронт
- `DuelCommandDeck`: рамка з літерою — `div` без жодних обробників кліку (і без `role="button"`/`tabIndex`). Візуально лишається як є.
- Удар — тільки `keydown` на `window`: шле `{matchId, promptId, k}`; ігнорувати `event.repeat`, `!event.isTrusted`, клавіші з модифікаторами (Ctrl/Alt/Meta).
- Під рамкою — підказка в стилі проєкту, що бити треба клавіатурою (наприклад «keyboard only. no clicking, chud.»).
- Дуель отримує дані матчу з `fight:state`; з URL лишається тільки `matchId`.
- `/lobby` і `/duel` — під `ProtectedRoute`.

## 5. JWT і автентифікація (бек + фронт)

### Бек
- `JwtStrategy.validate` завантажує користувача з БД і бере `role`, бан, наявність користувача звідти, а не з payload. Видалений → 401.
- **Бан = повний локаут** (рішення користувача): забанений не може нічого, навіть читати. Будь-який автентифікований HTTP-запит → 403 `code: 'BANNED'` (з `bannedUntil`, `banReason`); `POST /auth/login` для забаненого теж повертає цей 403 (щоб фронт показав екран бану); сокети відключаються при підключенні й одразу при бані. Публічні ендпоінти без токена (`GET /rooms`, профілі) забанений технічно бачить, але фронт показує йому тільки екран бану.
- Нова колонка `users.token_version int not null default 0`; кладеться в payload як `tv`. Інкремент при: зміні ролі, бані (у т.ч. автобані), vaporize. Токен з іншим `tv` → 401. Строк життя токена лишається 7 днів.
- Один спільний `WsAuthService` (або хелпер) для всіх gateway: токен з `handshake.auth.token` (сирий, без `Bearer`), та сама перевірка, що й HTTP (`tv`, бан). Невалідний → `disconnect`. `socket.data.user` = користувач.
- `MessagesGateway`: WS-хендлер `sendMessage` **видаляється** (фронт шле повідомлення через `POST /messages`; WS-шлях використовував лише мертвий `useroomSocket.ts`). `joinRoom` перевіряє доступ до приватної кімнати (член/пройшов пароль). Карантин лишається як зараз — read-only (читати і бачити live-події можна, писати не можна).
- `POST /messages` і `GET /messages/:roomId` перевіряють доступ до приватної кімнати; `POST /messages` — throttle 20/хв на користувача.
- `AdminGateway` переїжджає в namespace `/admin`, роль перевіряється в `handleConnection` (з БД), не через HTTP guards.
- Кожен автентифікований сокет приєднується до кімнати `user:{id}` (потрібно для realtime-оновлень, розділ 8).
- `JwtModule` реєструється один раз; `RequestUser` — один тип у `auth/`.
- `auth.controller` — DTO (`RegisterDto`, `LoginDto`) замість `any`; невірний логін/пароль → 401 (як і зараз по суті, але через DTO).
- Прибрати безглуздий `.unique()` з `users.password` (міграція).

### Фронт
- На старті застосунку (якщо є токен) — `GET /users/me`; оновити user/role в сторі. Адмін-гард використовує свіжу роль.
- 401 → `logout()`, `queryClient.clear()`, редірект на `/login`.
- 403 `BANNED` (з будь-якого запиту, логіну або сокет-події `user:banned`) → зберегти `{ bannedUntil, banReason }` у сторі, закрити сокети, і **весь застосунок** замінюється екраном бану `/banned` (будь-який інший маршрут редіректить туди, поки бан активний). Екран бану — фанова хуйня в стилі проєкту:
  - на весь екран, чорний фон, великий засічковий заголовок у рожевому світінні (наприклад «U GOT COOKED»), причина бану, живий відлік до `bannedUntil` (дні:год:хв:сек);
  - тролінг-копірайт, що змінюється кожні кілька секунд (орієнтири: «touch grass in the meantime», «ur aura is in the negatives now», «the mods have spoken. cry about it.»), стрічка-marquee як у варнах;
  - кнопка «appeal» нічого не робить, лише міняє текст на щось типу «appeal denied lmao» (кожен клік — нова фраза);
  - кнопка «logout» працює;
  - коли відлік доходить до 0 — кнопка «try again, bum», що робить `GET /users/me` і, якщо бан знято, повертає в застосунок;
  - повага до `prefers-reduced-motion`.

### Тости
- Перевірити й полагодити тости по всьому фронту: один `<Toaster>` на застосунок, стилі на токенах проєкту (зараз `#181818`/`#c40064` у `Provider.tsx` — привести до `--surface`/`--primary`, читабельний контраст), позиція і z-index поверх модалок/екрану дуелі/адмінки, без дублів (однакові тости — через `id`), помилки з бекенду показують `message` з уніфікованої відповіді, а не `[object Object]`/сирий axios-текст; кожна мутація в адмінці і профілі має success/error тост.
- Всі сокети (кімнати, fight club, admin) передають `auth: { token }` у сирому вигляді.

## 6. П'ять пунктів безпеки, які прямо просив користувач

1. **Mass assignment у профілі.** `POST /users/update` приймає тільки `UpdateProfileDto` (whitelist уже глобальний — прибрати `{...body}` і `as any`, передавати конкретні поля). `username` в DTO — ті ж правила, що при реєстрації. Перевіряти `canChangeProfile`.
2. **Файли.**
   - Тип визначається по вмісту (magic bytes, пакет `file-type`), а не по `originalname`/`mimetype` клієнта.
   - Профіль (аватар/банери): тільки `png|jpeg|webp|gif`, ≤ 5 МБ кожен.
   - Вкладення повідомлень: залишаються 5 × 10 МБ; дозволені картинки (`png|jpeg|webp|gif`), `pdf`, `txt`, `zip`, `mp4`, `webm`, `mp3`. **SVG і HTML заборонені.**
   - Ім'я об'єкта в MinIO = `uuid` + розширення з визначеного типу. `Content-Type` ставить сервер; для не-картинок/не-відео — `Content-Disposition: attachment`.
   - `useSSL` для MinIO — з env (`MINIO_USE_SSL`).
3. **CORS і rate limit.**
   - CORS — тільки origins з `CORS_ORIGINS` (кома-сепарований список) і для HTTP, і для всіх gateway.
   - `helmet` для HTTP.
   - `@nestjs/throttler` глобально (наприклад 120 запитів/хв на IP), суворіше на `POST /auth/login`, `POST /auth/register`, `POST /rooms/:id/join` (5/хв). `farm-aura` **виключити** з throttler (фіча).
   - Для сокетів — простий per-socket лімітер на `sendMessage` і `fight:hit` (fight:hit і так обмежений 150 мс).
4. **Паролі приватних кімнат.** Зберігати bcrypt-хеш; перевірка через `bcrypt.compare`. Одноразовий скрипт міграції `scripts/hash-room-passwords.ts`: хешує всі паролі, що не починаються з `$2`. Поле `password` ніколи не повертається з API (`GET /rooms`, `/rooms/:id`, `/rooms/by-name/:name`, адмін-ендпоінти) — замість нього `hasPassword: boolean`.
5. **Тести.** Див. розділ 11.

## 7. Логування — рефакторинг

- Пакети: `nestjs-pino` + `pino-http` (+ `pino-pretty` тільки dev).
- Формат: JSON у prod, pretty в dev (`LOG_LEVEL`, `NODE_ENV`).
- Correlation id: заголовок `x-request-id` (беремо вхідний або генеруємо), повертаємо у відповіді, автоматично в кожному лозі запиту. Для сокетів — `socketId` + `userId` у кожному лозі події через child logger.
- Redaction: `req.headers.authorization`, `*.password`, `*.token`, `handshake.auth`, тіла multipart.
- Глобальні фільтри винятків: HTTP (уніфікована відповідь `{ statusCode, message, requestId }`, 5xx логуються як `error` зі стеком, 4xx як `warn` без стеку) і WS (емітить `exception { message }` клієнту, логує).
- Доменні події (поле `event`, рівень `info`, якщо не вказано інше):
  - `auth.login.success`, `auth.login.failed` (`warn`, без пароля), `auth.register`;
  - `ws.connect`, `ws.disconnect`, `ws.auth_failed` (`warn`);
  - `fight.match.created|started|finished|rage_quit`, `fight.hit.rejected` (`debug`, з причиною), `fight.suspicious_cadence` (`warn`);
  - `admin.action` (крім аудиту в БД);
  - `user.autobanned` (`warn`);
  - `upload.rejected` (`warn`, причина, без вмісту).
- Прибрати всі `console.log`, `new Logger()` без контексту.
- Адмін-аудит у БД лишається; `PATCH /rooms/:id/status` і `DELETE /messages/:id`, коли їх викликає адмін, теж пишуться в аудит.

## 8. Адмінка — бек

- Нові ендпоінти: `GET /admin/users/:id` (повний користувач + `activeWarningsCount` + `bannedUntil` + `isAutoBanned`), `GET /admin/rooms/:id`.
- Всі відповіді адмінки в **camelCase** (без `warns_count` тощо); фронт прибирає `?? snake_case` фолбеки.
- `PATCH /admin/users/:id/modifiers`: `null` = очистити поле (`bannedUntil`, `yapCooldown` тощо); DTO розрізняє «не передано» і `null`.
- Відносні операції там, де фронт зараз шле абсолютні значення: `debtDelta`/`auraDelta` (атомарний `sql` інкремент), щоб повторні кліки не губились. Булеві тогли лишаються абсолютними.
- Мутації повертають оновлену сутність.
- Realtime:
  - в `/admin` namespace: `admin:user_updated { user }`, `admin:room_updated { room }`, `admin:message_deleted { id }`, `newAdminLog` (як зараз);
  - у кімнату `user:{id}`: `user:updated { user }`; при бані/vaporize — `user:banned { until, reason }` і примусовий `disconnect` усіх сокетів користувача + вихід з активного матчу fight club за звичайною логікою rage_quit;
  - видалення повідомлення адміном → `messageDeleted { id }` у кімнату чату;
  - карантин → `roomQuarantined` у кімнату чату.
- `vaporizeUser`: інкремент `token_version` до видалення не потрібен (користувача немає → 401), але відключити сокети.

### Причина бану
- Нова колонка `users.ban_reason text null`; в `modifiers` DTO — опційне `banReason` (очищається разом з `bannedUntil: null`). Автобан пише `ban_reason = 'автобан: 3 варни. ur cooked.'`.
- Помилки бану мають фіксований маркер: `{ statusCode: 403, code: 'BANNED', message, bannedUntil, banReason, requestId }` — фронт відрізняє їх від інших 403.

### Автобан
- При видачі варну рахуємо **активні** варни (`revokedAt IS NULL`). Якщо ≥ 3 — `bannedUntil = now + 7 днів`, `autoBannedAt = now` (нова колонка), інкремент `token_version`, аудит + лог `user.autobanned`, realtime-кік.
- Відкликання варну **не** знімає бан автоматично; адмін може зняти вручну (`bannedUntil: null`).

## 9. Адмінка — фронт

### Дані
- `useAdminUser` / `useAdminRoom` — тільки з нових detail-ендпоінтів; ніякого читання з кешу списку, ніякого фолбеку `search: userId`.
- Мутації: `setQueryData` для detail з відповіді + `invalidateQueries(['admin','users'])` (список).
- Списки: `placeholderData: keepPreviousData`, скелетон при першому завантаженні, «No results» тільки коли реально 0 і не `isFetching`.
- `useAdminSocket` (namespace `/admin`): на `admin:*_updated` — `setQueryData` detail + інвалідація списку; підписка після `connect`.
- Quick actions шлють дельти (`debtDelta: 100`), а не `debt + 100`.
- `staleTime` для адмінки 10 с.

### Візуал
- Прибрати окрему синю палітру; адмінка на токенах проєкту (`--bg #09090b`, `--surface #18181b`, `--primary #fa4d98`, `--muted`, `--border`), рожеве світіння, gradient top-border як у `Duel.module.css`, засічковий логотип (як CHATIX / FIGHT CLUB), Courier New для логів/цифр.
- Лейаут: ліворуч сайдбар (використати існуючий невикористаний `AdminPanelSidebar.tsx` або видалити, якщо не підходить) з розділами users / rooms / messages / audit; праворуч контент. Список з фіксованою висотою і власним скролом (без розтягування сторінки).
- Рядок користувача: аватар, username, бейджі (`ADMIN`, `BANNED`, `CLOWN`, `[WARN n/3]` з кольоровою шкалою), аура/борг.
- Аудит-фід — «термінал» на Courier, нові записи анімовано вїжджають (з повагою до `prefers-reduced-motion`).
- Копірайт у вайбі проєкту: lowercase, брейнрот (приклади-орієнтири: «no chuds found. lower the standards.», «this mf is cooked (3/3)», «vaporize this bum», «warn reason (be creative)»). Деструктивні дії — підтвердження з тролінг-текстом.
- Адаптив до 768 px мінімум.
- Видалити мертві файли: `App.css`, `hooks/useroomSocket.ts`, невикористані адмін-компоненти (`actions/AdminLogActions.tsx`, `.adminLayout`/`.mainContent`, якщо не використано в новому лейауті).

## 10. Профіль і пасхалка — фронт (+ бек)

### Стрічка варнів
- Бек: `GET /users/profile/:username` повертає `activeWarnings: { reason, createdAt }[]` (лише активні, без `adminId`).
- Фронт: якщо є активні варни — над верхнім банером профілю горизонтальна «біжуча стрічка» (marquee на CSS `@keyframes`, безшовний повтор), стиль «поліцейської стрічки»: чорно-рожеві смуги, моноширинний шрифт, текст `⚠ WARN 1/3: <reason> ⚠ ...`. При `prefers-reduced-motion` — статична, з горизонтальним скролом. Не показується, якщо варнів 0.

### Бокові банери
- `ProfileSidebar`: фіксовані максимальні розміри (орієнтир: `max-width: 220px`, `max-height: 640px`), `object-fit: cover`, `position: sticky; top: …` — не тягнуться разом зі сторінкою. Ті ж пропорції в превʼю `EditProfile` (`.sideBannerSize`).

### Пасхалка входу у fight club
- Без явних кнопок/посилань. Тригер: декоративний «lmao» у полі пошуку на `/rooms` — **3 кліки протягом 1,5 с** (або ввести в пошук `first rule`). Ефект: короткий глітч рожевим (≤ 600 мс, з `prefers-reduced-motion` — без анімації), тост «we don't talk about it.», перехід на `/lobby`.
- Неавторизований — тост «login first, chud» і редірект на `/login`.

## 11. Архітектура бекенду і тести

- `UsersRepository` переїжджає в `UsersModule` (експортується), `AuthModule` імпортує `UsersModule` — без циклів (`forwardRef` тільки якщо неминуче).
- `DatabaseModule` імпортується в `AppModule`, а не через `AdminModule`.
- Конфіг: `@nestjs/config` з валідацією env при старті (class-validator схема): `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `MINIO_*`, `LOG_LEVEL`. Оновити `.env.example`.
- WS payloads — DTO + `ValidationPipe` для сокетів (через `@UsePipes` на gateway), у т.ч. `title` з лімітом довжини, `k` — одна літера.
- Enum-валідація для `status` / `publicity` кімнат (DTO замість `@Body('x')`).
- Транзакції: повідомлення + вкладення; видалення вкладень + оновлення повідомлення.
- `GET /messages/:roomId`: перевірка доступу (приватна кімната) + курсорна пагінація (`before`, `limit` ≤ 100, дефолт 50). Фронт чату: підвантаження старіших при скролі вгору (мінімально — кнопка «load older»).
- Атомарні оновлення: `farm-aura` (без ліміту), `payDebt`, ставки fight club — через `sql\`col + n\``.
- `respectCount`: або використовувати колонку з атомарним інкрементом, або видалити — обрати колонку.
- Прибрати дублі (`RequestUser`, подвійний `JwtModule`), `findById` двічі у `vaporizeUser`.
- **Тести (jest):**
  - видалити/полагодити заглушки «should be defined», які падають;
  - unit: `FightClubService` (promptId, reaction time, чужий сокет, баланс, неіснуючий матч), `AuthService`, `JwtStrategy` (tv, бан, роль з БД), автобан, хешування паролів кімнат, валідація файлів по magic bytes, modifiers з `null`;
  - e2e (supertest, тестова БД через `DATABASE_URL` для тестів): register/login, admin guard (не-адмін → 403), `POST /users/update` ігнорує зайві поля, `GET /rooms` не повертає password.
  - `npm run lint`, `npm run build`, `npm test` зелені в беку; `npm run lint`, `npm run build` у фронті.

## 12. Контракт бек ↔ фронт (зведення змін)

| Що | Було | Стало |
|---|---|---|
| WS auth (усі) | різне / немає | `io(url, { auth: { token } })`, сирий JWT |
| Admin socket | default namespace, `joinAdminLogs` | namespace `/admin`, кімната автоматично |
| `fight:start`/`fight:update` | `firstKey`/`nextKey` | `prompt: { promptId, key }` |
| `fight:hit` | `{matchId, k}` | `{matchId, promptId, k}` (тільки з клавіатури) |
| нове | — | `fight:state`, `fight:error` |
| WS `sendMessage` | `{..., authorId}` | видалено, тільки `POST /messages` |
| помилка бану | 403 без маркера | `code: 'BANNED'`, `bannedUntil`, `banReason` |
| нові WS | — | `user:updated`, `user:banned`, `messageDeleted`, `roomQuarantined`, `admin:user_updated`, `admin:room_updated`, `admin:message_deleted` |
| `GET /admin/users/:id`, `/admin/rooms/:id` | немає | є |
| modifiers | абсолютні, null ігнорується | `debtDelta`/`auraDelta`, `null` очищає |
| кімнати | `password` у відповіді | `hasPassword` |
| профіль | — | `activeWarnings[]` |
| `GET /messages/:roomId` | все одразу | `?before&limit`, відповідь `{ items, nextCursor }` |
| помилки | різні | `{ statusCode, message, requestId }`; 403 бан містить `bannedUntil` |
| регістр полів | змішаний | camelCase |

## 13. Що лишається на розсуд виконавця

Структура файлів усередині модулів, назви внутрішніх класів, конкретна анімація глітчу/стрічки, точні відступи й розміри в адмінці (в межах токенів), конкретні значення throttler у межах наведених орієнтирів.

## 14. Рішення, які зробив Claude (перевір)

- Автобан: **7 днів**, відкликання варну бан не знімає.
- Тригер пасхалки: потрійний клік по «lmao» / пошук `first rule`.
- Мінімальний час реакції 120 мс.
- Варни в стрічці профілю видно всім (публічно), без імені адміна.
- Логування на `nestjs-pino`; rate limit на `@nestjs/throttler`; перевірка файлів на `file-type`; `helmet`.
- Пагінація повідомлень курсорна, 50 за раз.
- Невалідний/застарілий токен (tv) → 401 і розлогін; refresh-токенів не вводимо.
- Челендж у лобі живе, поки творець онлайн (grace 10 с), а не поки живий конкретний сокет.
- Логін забаненого повертає 403 `BANNED` (а не 401), щоб показати екран бану.
- WS `sendMessage` видаляється; приватні кімнати перевіряються і на `POST`/`GET /messages`; карантин лишається read-only.
- Для причини бану — колонка `ban_reason`, текст автобану в стилі проєкту.
