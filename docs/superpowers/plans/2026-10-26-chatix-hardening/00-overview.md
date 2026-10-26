# Chatix Hardening — Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Кожен воркер виконує **лише свій файл-план** (див. таблицю нижче), але Global Constraints цього файлу діють для всіх.

**Goal:** Закрити чити fight club (QTE лише з клавіатури), дірки в auth/JWT/сокетах/файлах, зробити структуровані логи, полагодити й перемалювати адмінку, додати автобан, стрічку варнів, екран бану, пасхалку входу у fight club.

**Architecture:** Два репо. Бек: спершу фундамент (конфіг, логи, фільтри помилок, auth з перевіркою по БД, спільна WS-auth і realtime-сервіс, міграція), далі паралельно безпека / fight club / адмінка. Фронт: спершу ядро (помилки, тости, сесія, сокети, екран бану), далі паралельно гравцеві екрани / адмінка. Фронт і бек паралельні, бо зв'язані контрактом зі специфікації (§12).

**Tech Stack:** NestJS 11, drizzle-orm + postgres, socket.io 4, passport-jwt, minio, jest; React 19, Vite 8, @tanstack/react-query 5, zustand 5, socket.io-client, react-hot-toast, CSS Modules.

**Spec:** `C:\Users\zakhar\WebstormProjects\chatix-backend\chatix-backend\docs\superpowers\specs\2026-10-26-chatix-hardening-design.md` — читати повністю перед роботою.

## Воркери, гілки, порядок

Виконавці: Codex, модель `codex-6-luna`, через Orca, кожен у своєму worktree. Рев'ю та злиття — Claude.

| Фаза | Воркер | Репо | План | Гілка (від) |
|---|---|---|---|---|
| 0 | BE-0 Foundation | бек | `be-0-foundation.md` | `refactor/auth-logging-foundation` (від `feat/hardening`) |
| 0 | FE-1 Core | фронт | `fe-1-core.md` | `feat/session-toasts-ban-screen` (від `feat/hardening`) |
| 1 | BE-1 Security | бек | `be-1-security.md` | `fix/security-hardening` (від `feat/hardening` після злиття BE-0) |
| 1 | BE-2 Fight club | бек | `be-2-fight-club.md` | `fix/fight-club-anticheat` (так само) |
| 1 | BE-3 Admin & warnings | бек | `be-3-admin.md` | `feat/admin-autoban-realtime` (так само) |
| 1 | FE-2 Player UI | фронт | `fe-2-player.md` | `feat/qte-easter-egg-profile` (від `feat/hardening` після злиття FE-1) |
| 1 | FE-3 Admin panel | фронт | `fe-3-admin.md` | `feat/admin-panel-redesign` (так само) |
| 2 | Claude (+ 1 воркер на фікси) | обидва | розділ «Фаза 2» нижче | `feat/hardening` |

- Інтеграційна гілка `feat/hardening` створюється від `main` в кожному репо до старту фази 0.
- Після кожного воркера: рев'ю Claude (відповідність спеці й плану, якість коду, антипатерни, безпека/JWT) → фікси тим самим воркером → merge `--no-ff` у `feat/hardening`.
- Фаза 1 стартує лише після злиття фази 0 відповідного репо.
- Порядок злиття фази 1 (через спільні файли `messages.controller/service`, `room.controller`, `users.service`, `App.tsx`): бек — BE-1 → BE-2 → BE-3; фронт — FE-2 → FE-3. Наступна гілка перед злиттям робить `git rebase feat/hardening` і проганяє тести.
- Push і PR у `main` — тільки після підтвердження користувача.

## Global Constraints

- Нові залежності бек: тільки `nestjs-pino`, `pino-http`, `pino-pretty` (dev), `@nestjs/throttler`, `helmet`, `file-type@16.5.4` (остання CJS-версія; ESM-версії не підтримуються Nest CJS-збіркою). Фронт: **жодних нових залежностей**.
- Схема БД змінюється **лише** в BE-0 однією міграцією `0011_auth_hardening` (`token_version`, `ban_reason`, `auto_banned_at`, зняття unique з `users.password`). Інші воркери міграцій не генерують.
- `farm-aura` — безліміт (фіча), без throttler; аура і борг **можуть бути від'ємними** — ніде не клампити і не перевіряти баланс.
- Бан = повний локаут: будь-який автентифікований HTTP → 403 `{ statusCode: 403, code: 'BANNED', message, bannedUntil, banReason, requestId }`; логін забаненого → той самий 403; сокети відключаються.
- Формат помилки HTTP: `{ statusCode, message, requestId, code? , ...extra }`. WS-помилка: подія `exception` з `{ message, code? }`.
- WS auth: `io(url, { auth: { token } })`, сирий JWT. Namespaces: default (чат + user-кімната), `/fight-club`, `/admin`.
- Fight club — QTE тільки з клавіатури; мінімальна реакція `120` мс; стан `1` с; комбо як зараз.
- Автобан: поріг `3` активних варни (`revokedAt IS NULL`), тривалість `7` днів, причина `'автобан: 3 варни. ur cooked.'`; відкликання варну бан не знімає.
- Адмін-відповіді — camelCase. Публічні ендпоінти користувачів зберігають поточні назви полів (фронт на них зав'язаний), крім явно змінених у спеці.
- Копірайт UI: lowercase, брейнрот/тролінг, як у проєкті («chud», «bum», «mogged», «cooked»). Анімації поважають `prefers-reduced-motion`.
- Стиль фронту: токени з `src/index.css` (`--bg #09090b`, `--surface #18181b`, `--primary #fa4d98`, `--text`, `--muted`, `--border`), засічковий логотип (Times New Roman, letter-spacing 4px), Courier New для моно. Окремої синьої палітри адмінки більше немає.
- Логи ніколи не містять паролів, JWT, `handshake.auth`, вмісту файлів.
- Наприкінці кожного воркера: бек — `npm run lint`, `npm run build`, `npx jest` зелені; фронт — `npm run lint`, `npm run build`, `npm test` зелені.
- Git-ідентичність для всіх комітів: `GboyYouMam <kozahar185@gmail.com>` (вже стоїть у локальному `git config` обох репо; worktree її успадковують — не змінювати й не передавати `--author` інший).
- Гілки — за конвенцією `<type>/<kebab-опис>` (`feat/`, `fix/`, `refactor/`, `chore/`, `test/`, `docs/`), назви — з таблиці вище; якщо воркеру потрібна додаткова гілка для фіксів після рев'ю — `fix/<те саме-опис>-review`.
- Коміти — дрібні, Conventional Commits: `<type>(<scope>): <опис>` lowercase, без крапки в кінці (наприклад `fix(fight-club): reject hits from foreign sockets`, `feat(admin): add user detail endpoint`, `chore(deps): add nestjs-pino`, `test(auth): cover token version mismatch`). Scope = модуль/область. Один логічний крок = один коміт.

## Review Focus

1. **Старі токени без `tv`** після деплою: payload без `tv` трактується як `tv = 0`, тож користувачі з `token_version = 0` не вилітають масово. Тест — BE-0 Task 4.
2. **Перехід лобі → дуель** відкриває новий сокет: челендж не має зникнути (grace 10 с, прив'язка до userId). Тест — BE-2 Task 3.
3. **Бан, що вже минув** (`bannedUntil` у минулому) не блокує; користувач на екрані бану після закінчення відліку натискає «try again, bum» і повертається. Тест — BE-0 Task 4 (минулий бан пропускається), FE-1 Task 4 (відлік `expired`).
4. **Підробні файли**: PNG-вміст з іменем `x.html` зберігається як `.png`; SVG/HTML з `mimetype: image/png` відхиляються. Тест — BE-1 Task 2.
5. **Автобан при вже довшому бані** не скорочує бан: `bannedUntil = max(існуючий, now + 7d)`; зняття бану адміном (`bannedUntil: null`) очищає і `banReason`. Тест — BE-3 Task 3.

---

## Фаза 2: інтеграція (Claude)

- [ ] Підняти postgres + minio (`docker-compose up -d`), `npm run db:migrate`, `npm run db:hash-room-passwords`, запустити бек і фронт.
- [ ] `npm run test:e2e` у беку — зелено.
- [ ] QA через браузер (Playwright) по сценаріях: логін/реєстрація; чат з файлами; приватна кімната з паролем; дуель двох користувачів (клік по рамці нічого не робить, клавіатура б'є, затиснута клавіша не спамить); пасхалка; адмінка (зміна юзера одразу видна без перезаходу, список без блимання); 3 варни → автобан → екран бану в реальному часі; стрічка варнів у профілі; бокові банери не тягнуться; тости.
- [ ] Фінальне рев'ю всієї `feat/hardening` в обох репо.
- [ ] Запитати користувача про push і PR у `main`.
