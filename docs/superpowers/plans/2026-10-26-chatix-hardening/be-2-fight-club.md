# BE-2 Fight Club Anti-cheat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fight club як чесний клавіатурний QTE: одноразові промпти, перевірка власника сокета і часу реакції, коректний життєвий цикл челенджу, стан матчу з сервера замість URL, атомарний розрахунок ставок (мінус дозволено), доменні логи.

**Architecture:** Чисті функції промптів/каденсу в окремому файлі; `FightClubService` працює з `userId` (із `client.data.user`, який ставить `WsAuthService` з BE-0) і повертає результати, а gateway лише емітить. Стан у пам'яті лишається (`Map`).

**Tech Stack:** NestJS 11 websockets, socket.io, drizzle-orm, jest.

**Spec:** `docs/superpowers/specs/2026-10-26-chatix-hardening-design.md` (§4, §7 fight-події, §12). Global Constraints: `docs/superpowers/plans/2026-10-26-chatix-hardening/00-overview.md`.

Гілка: `fix/fight-club-anticheat` від `feat/hardening` (після злиття BE-0).

**Consumes з BE-0:** `WsAuthService.authenticate` (вже підключено в gateway), `client.data.user: RequestUser`, `wsValidationPipe`, `WsExceptionsFilter`, `RealtimeService.register`, `DbOrTx`. Ban-kick: `RealtimeService.disconnectUser` відключає сокети → твій `handleDisconnect` має відпрацювати як rage_quit.

---

### Task 1: Промпти, перевірка удару, час реакції

**Files:**
- Create: `src/fight-club/fight-prompt.ts`, `src/fight-club/fight-prompt.spec.ts`, `src/fight-club/dto/fight-hit.dto.ts`
- Modify: `src/fight-club/types/types.ts`, `src/fight-club/fight-club.service.ts:142-209` (`handleHit`), `:278-291` (`startMatch`), `src/fight-club/fight-club.service.spec.ts`

**Interfaces:**
- Produces (`fight-prompt.ts`): `MIN_REACTION_MS = 120`, `STUN_MS = 1000`, `HIT_COOLDOWN_MS = 150` (перенести існуючі значення сюди); `interface FightPrompt { promptId: string; key: string; sentAt: number }`; `createPrompt(now: number, previousKey?: string): FightPrompt` — `promptId = randomUUID()`, `key` — з того ж алфавіту, що використовується зараз у сервісі (перенести константу), не дорівнює `previousKey`; `toPublicPrompt(p: FightPrompt): { promptId: string; key: string }`.
- Types: `MatchState.currentKey` → `MatchState.prompt: FightPrompt`; `PlayerState` додає `username: string`, `hitTimestamps: number[]` (останні 11).
- Produces: `FightHitDto { @IsUUID() matchId; @IsUUID() promptId; @IsString() @Length(1,1) k }`.
- Produces: `FightClubService.handleHit(userId: string, socketId: string, dto: FightHitDto, now: number): HitResult`, де
  `type HitResult = { kind: 'rejected'; reason: 'no_match' | 'not_player' | 'foreign_socket' | 'stale_prompt' | 'stunned' | 'cooldown' } | { kind: 'miss'; stunMs: number } | { kind: 'hit'; update: FightUpdate } | { kind: 'ko'; update: FightUpdate; winnerId: string }`.
  Правила по черзі: немає матчу / не FIGHTING → `no_match`; userId не гравець → `not_player`; `socketId` ≠ socketId цього гравця → `foreign_socket`; у стані → `stunned`; < `HIT_COOLDOWN_MS` від останнього удару → `cooldown`; `promptId` ≠ поточного → `stale_prompt`; `now - prompt.sentAt < MIN_REACTION_MS` або `k.toUpperCase() !== prompt.key` → `miss` (стан `STUN_MS`); інакше hit: шкода/комбо як зараз, новий промпт `createPrompt(now, key)`.
- Produces: `FightUpdate { matchId; hp: Record<userId, number>; combo: Record<userId, number>; prompt: { promptId; key } }`. `fight:start` віддає `{ matchId, prompt }`, `fight:update` — `FightUpdate`. Поля `firstKey`/`nextKey` видалити.

- [ ] **Step 1: Тести** (`fight-club.service.spec.ts`, час передається параметром, без фейкових таймерів): удар з `promptId` попереднього промпту → `stale_prompt`; той самий `promptId` двічі (другий після валідного удару) → `stale_prompt`; удар через 119 мс після промпту з правильною літерою → `miss`; через 120 мс → `hit`; правильний `userId`, але чужий `socketId` → `foreign_socket`; не учасник → `not_player`; удар у стані → `stunned`; нижній регістр `'a'` при ключі `'A'` → `hit`; після `hit` новий `promptId` ≠ старому і `key` ≠ попередньому. `fight-prompt.spec.ts`: 1000 викликів `createPrompt(0, 'A')` ніколи не дають `'A'`.
- [ ] **Step 2:** `npx jest src/fight-club` → FAIL.
- [ ] **Step 3:** Реалізувати; переписати існуючі 10 тестів під нову сигнатуру, не втрачаючи покриття комбо/шкоди.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(fight-club): one-time prompts and server-side hit validation`.

### Task 2: Детектор підозрілого каденсу

**Files:**
- Modify: `src/fight-club/fight-prompt.ts`, `src/fight-club/fight-prompt.spec.ts`, `src/fight-club/fight-club.service.ts`

**Interfaces:**
- Produces: `isSuspiciousCadence(timestamps: number[]): boolean` — `true`, якщо є ≥ 11 міток (10 інтервалів) і стандартне відхилення останніх 10 інтервалів < `15` мс. Сервіс після кожного `hit` логує `warn` `{ event: 'fight.suspicious_cadence', matchId, userId }` (не частіше одного разу на матч на гравця), без покарання.

- [ ] **Step 1: Тести:** 11 міток з кроком рівно 200 мс → `true`; з інтервалами 180/260/210/... (σ > 15) → `false`; 10 міток → `false`.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(fight-club): log suspicious hit cadence`.

### Task 3: Життєвий цикл матчу і стан з сервера

**Files:**
- Create: `src/fight-club/dto/fight-create.dto.ts`, `src/fight-club/dto/fight-join.dto.ts`
- Modify: `src/fight-club/fight-club.service.ts` (`createMatch`, `joinMatch`:72-135, `handlePlayerDisconnect`:237-275), `src/fight-club/fight-club.gateway.ts`, `src/fight-club/types/types.ts`, `src/fight-club/fight-club.service.spec.ts`

**Interfaces:**
- Produces: `FightCreateDto { @IsString() @Length(1, 60) title; @IsIn(['aura','debt']) stakeType; @IsInt() @Min(1) @Max(1_000_000) stakeAmount }`; `FightJoinDto { @IsUUID() matchId }` — клієнт більше **не** шле `opponentId`/`stakeType`/`stakeAmount`/`userId`.
- `createMatch(user: RequestUser, socketId: string, dto)` — творцю одразу записується `socketId`; userId і username тільки з `client.data.user`.
- `joinMatch(user, socketId, dto): FightState` — немає матчу → `WsException('match not found. it got cooked.')`; якщо user — творець: оновити його `socketId` (перехід лобі → дуель); якщо інший користувач і матч LOBBY: стає `player2` і матч стартує, коли обидва гравці під'єднані з сокетів дуелі (зберегти поточну семантику автостарту); третій користувач → `WsException('fight is full')`.
- Produces: `FightState { matchId; title; status: 'lobby' | 'fighting' | 'fight_over'; role: 'creator' | 'challenger'; you: { id; username }; opponent: { id; username } | null; stakeType; stakeAmount }` → емітиться викликачу як `fight:state` у відповідь на `fight:join`.
- Grace: `handlePlayerDisconnect(userId, socketId)` — якщо сокет не той, що записаний у гравця, нічого не робити; LOBBY: запустити таймер `LOBBY_GRACE_MS = 10_000` на `userId`; таймер скасовується, якщо той самий userId знову приєднався до матчу (`fight:join`) або має інший живий сокет у namespace (`server.in('user:'+userId).fetchSockets()`); після спливання — видалити челендж і `fight:challenge_removed`. FIGHTING: rage_quit як зараз.
- Логи: `fight.match.created`, `fight.match.started`, `fight.match.finished` (`winnerId`, `stakeType`, `stakeAmount`), `fight.match.rage_quit`, `fight.hit.rejected` (`debug`, `reason`).

- [ ] **Step 1: Тести** (таймери — `jest.useFakeTimers()`): творець від'єднує лобі-сокет і за 3 с приєднується з нового сокета через `fight:join` → матч живий і його `socketId` новий (Review Focus #2); творець від'єднується і не повертається 10 с → матч видалено; `fight:join` на випадковий uuid → `WsException`; третій користувач → `WsException`; `fight:state` для челенджера має `role: 'challenger'` і `opponent.id` = творця; від'єднання у FIGHTING → rage_quit.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(fight-club): tie challenges to users and serve match state`.

### Task 4: Атомарний розрахунок і помилки результату

**Files:**
- Modify: `src/fight-club/fight-club.repository.ts` (`:58` і метод розрахунку), `src/fight-club/fight-club.service.ts:209-234`, `src/fight-club/fight-club.repository.spec.ts`

**Interfaces:**
- Produces: `FightClubRepository.settle(winnerId: string, loserId: string, stakeType: 'aura' | 'debt', amount: number): Promise<void>` — одна транзакція, лише `sql\`${col} + ${n}\`` / `- n`; семантика переказу (хто що отримує/втрачає) — як у поточному коді; **жодних клампів і перевірок балансу** (аура і борг можуть бути від'ємними).
- Помилка `settle` → лог `error` з `matchId`, обом гравцям `fight:error { message: 'the soap market crashed. result not saved, try again.' }`, матч видаляється.

- [ ] **Step 1: Тести:** unit з мок-транзакцією — `settle` формує два атомарні оновлення в одній транзакції; переможець з аурою 0 і програвший з аурою 10 при ставці 50 → програвший має `-40` (інтеграційно через `createTestApp`, якщо доступна тестова БД; інакше — перевірка SQL-виразу без `GREATEST`); падіння `settle` → обидва сокети отримують `fight:error`.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `fix(fight-club): settle stakes atomically and report failures`.

### Task 5: Gateway

**Files:**
- Modify: `src/fight-club/fight-club.gateway.ts`, `src/fight-club/fight-club.gateway.spec.ts`

**Interfaces:**
- Усі `@SubscribeMessage` беруть `user` з `client.data.user` і DTO через `wsValidationPipe`; gateway лише мапить `HitResult` на події: `miss` → `client.emit('fight:stun', { stunDuration })`; `hit` → `to(matchId).emit('fight:update', update)`; `ko` → `fight:update` + `fight:game_over`; `rejected` → нічого клієнту (лише `debug`-лог), щоб не підказувати боту.
- Прибрати ручний парсинг токена (вже робить `WsAuthService`), `'FUH U ARE UNAUTHORIZED GET OUT'` лишити як текст `exception` при невдалій автентифікації — узгодити з BE-0 хелпером.

- [ ] **Step 1: Тести** gateway з моком сервісу: `ko` → два еміти в правильному порядку; `rejected` → жодного еміту клієнту.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** Реалізувати. - [ ] **Step 4:** `npx jest`, `npm run lint`, `npm run build` → чисто; ручна дуель двома клієнтами `socket.io-client` (скрипт у `scripts/` не комітити).
- [ ] **Step 5: Commit** `refactor(fight-club): thin gateway over validated service results`.
