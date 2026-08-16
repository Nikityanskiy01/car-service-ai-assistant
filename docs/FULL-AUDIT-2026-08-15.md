# Полный аудит проекта (без безопасности) — повторная оценка

**Проект:** Интеллектуальный ассистент автосервиса (`car-service-ai-assistant`)  
**Дата повторной оценки:** 16 августа 2026 (вечер, после S30 и hotfix «без ответа 15 мин»)  
**Объект:** рабочая копия на диске — код, Compose, CI, тесты, документация, продуктовая полнота  
**Исключено по запросу:** информационная безопасность (auth/JWT/RBAC/XSS/CSRF/секреты/threat model). Смежные темы надёжности и эксплуатации (health-пробы, персистентность очередей, наблюдаемость) включены как operational quality.

Это **не правка журнала**, а независимая пересъёмка. Заявленный итог S30 **9.4 / 10** не подтверждён: это арифметика спринтов (+0.1 за CSS-слой), а не сверка с эталоном 2026. Колонка «Статус» в §20: ✅ сделано и подтверждено · ◐ частично / регресс · ☐ открыто.

---

## 0. Паспорт аудита

| Поле | Факт на 16.08.2026 вечером |
|------|----------------------------|
| Стек | React 19 + Vite 7 + TypeScript (frontend) · Node.js 22 + Express + Prisma 6 + PostgreSQL 16 · Redis 7 / BullMQ · LLM OpenAI-compatible / Ollama |
| Форма | Modular monolith, SPA + REST, Docker Compose: `frontend`, `backend`, `worker`, `db`, `redis`, `mailpit` (profile `mail`), `otel-collector` (profile `observability`) |
| Backend | **183** файла TS в `backend/src`, **0** JS, **22 547** строк |
| Frontend | **414** файла TS/TSX в `frontend/src`, **41 484** строк (без тестов **369** файлов / **38 952** строк) |
| CSS | **73** файла, **24 517** строк; barrel `main.css` / `site.css`; **ни одного файла >700** (макс. `manager-workdesk.css` 641) |
| Тесты | Backend **63** `*.test.js`, **227** кейсов · Frontend **44** файла, **161** кейс · E2E **6** spec (в т.ч. Pixel 7) · k6 **1** · eval **38** сценариев |
| Миграции Prisma | **41** |
| HTTP | Инвентарь **188** маршрутов (`docs/api-route-inventory.json`, `generatedAt: 2026-08-15`); `openapi:check` = 188=188. Живой `/` **200**, `/api/live` **live** |
| OpenAPI | **0.5.0**, 188 ops. Именованные схемы: Problem, ConsultationCreate, Consultation, BookingCreate, Booking, BookingList, ServiceRequest, CursorPage. Остальные ops — `object` stub |
| Runtime tonight | `backend` / `frontend` / `worker` / `db` / `redis` — healthy. `/api/v1` — rewrite-alias тех же маршрутов |

### Методология

Сопоставление с практиками 2025–2026:

| Слой | Эталон |
|------|--------|
| Качество продукта | ISO/IEC 25010:2023 (кроме Security) |
| Архитектура | 12-Factor, modular monolith |
| API | OpenAPI 3.x как артефакт поставки, RFC 9457, cursor-pagination, идемпотентность |
| Наблюдаемость | OpenTelemetry, logs / metrics / traces, RED, SLO |
| Платформа | split live/ready, лимиты, независимый worker |
| Frontend | React 19, Vite 7, WCAG 2.2 AA, Core Web Vitals |
| Данные | migrate-as-code, пул соединений, векторный индекс для RAG |
| ИИ | eval на живой модели, версии промптов, RAG с pgvector |
| Тесты | Testing Trophy, контрактные тесты, coverage gates, зелёный lint в CI |
| Документация | Diátaxis |
| DX | workspaces, Prettier, git-hooks, Conventional Commits |

Оценки **0–10** относительно production-стандарта 2026, не относительно прототипа. **6** = можно демонстрировать и пилотировать с долгом. **8+** = рост команды и нагрузки без переписывания платформы.

- **P0** — ломает прод, даёт ложную уверенность в качестве или теряет данные при штатных событиях.
- **P1** — существенный разрыв со стандартом; ближайший квартал.
- **P2** — системный долг.
- **P3** — гигиена.

### 0.1 Журнал спринтов (что заявлялось) и верификация tonight

| Спринт | Заявленный фокус | Верификация 16.08 вечером |
|--------|------------------|---------------------------|
| **S1** | CI e2e + backend, live/ready, Redis AOF, nginx SSE, инвентарь | ✅ подтверждено |
| **S2** | Error Boundary, RFC 9457, бэкапы uploads, env example, outbox key, diagnosis fail, `<main>` | ✅ подтверждено (RFC 9457 + `{error,code}` сосуществуют) |
| **S3** | Prometheus, k6, jsx-a11y, CI hygiene, бренд, конституция LLM, SEO-база, события | ✅; кнопка MASTER починена в **S6** |
| **S4** | OTel, axe e2e, Idempotency-Key, outbox poller, diagnosis_shown, architecture.md | ✅ подтверждено |
| **S5** | полный OpenAPI, распил CSS, Compose worker | ◐ CSS и worker — да. YAML контракта восстановлен в **S6** |
| **S6** | Гейты: OpenAPI YAML, зелёный lint, README/MASTER, prod env TOTP/HMAC, Redis user 999 | Закрыт; Docker healthy |
| **S7** | Распил `consultationFlowService` + тексты консультации | Закрыт |
| **S8** | pgvector case memory + лимит JSON-скана | Закрыт |
| **S9** | Распил `ConsultPage` / гаража (хуки + labels) | Закрыт |
| **S10** | Распил `serviceRequests.service.js` → фасад + `service/*` | Закрыт |
| **S11** | Распил `consultationAi.service.js` → фасад + `consultationAi/*` | Закрыт |
| **S12** | Распил `BookingPage`, JSX гаража, `dashboard-widgets.css`; orphan-страницы | Закрыт 16.08 |
| **S13** | Распил `vehicles.css` / `client-overview.css`; nightly live LLM eval | Закрыт 16.08 |
| **S14** | Распил `consultations.service.js` / `ManagerRequestDetailPage`; live eval diagnosis + fail-closed nightly | Закрыт 16.08 |
| **S15** | Распил `integrations.service.js` / `dashboard.ts` | Закрыт 16.08 |
| **S16** | Распил `vehicles-service-book.css` / остатка `dashboard-widgets.css` | Закрыт 16.08 |
| **S17** | Распил `useConsultPage` / `ConsultPage` → хуки session/chat/request + Chrome/Workspace/Modal | Закрыт 16.08 |
| **S18** | Распил `profile.css` на hero/settings, security/2FA, sessions, password, responsive | Закрыт 16.08 |
| **S19** | Распил `client-cases.css` на card/progress, bookings, detail, overview, visit | Закрыт 16.08 |
| **S20** | Распил `consultationFlow/extract.js` → фасад + `extract/{hints,regex,rules,policy,llm}` | Закрыт 16.08 |
| **S21** | Распил `dashboard-shell.css` на layout/menu, notifications, page/desk | Закрыт 16.08 |
| **S22** | Распил `booking-app.css` на wizard, detail, breakpoints, client polish | Закрыт 16.08 |
| **S23** | Распил `manager-console.css` на desk/toasts, queue, calendar/clients/pages | Закрыт 16.08 |
| **S24** | Распил `base.css` / `admin.css` на chrome/landing/forms и overview/ops/tools | Закрыт 16.08 |
| **S25** | Распил публичного `inner-pages.css` на about, services hero, services grid, chrome | Закрыт 16.08 |
| **S26** | Распил `dashboard-consultation.css` / `dashboard-alerts.css` на page/chat/composer и banners/ops/completion | Закрыт 16.08 |
| **S27** | Распил публичных `home.css` / `gallery.css` на hero/sections/auth и page/grid/lightbox | Закрыт 16.08 |
| **S28** | Распил публичных `booking.css` / `works.css` на wizard/public и page/modal/breakpoints; правило css-layers | Закрыт 16.08 |
| **S29** | Backend `src/` на TypeScript: tsx runtime, `tsc --noEmit` в lint, Express/env типы | Закрыт 16.08 |
| **S30** | Бэклог платформы: CRM-адаптеры, SMS, v1/cursor, OpenAPI-схемы, CI k6/LH/coverage, RUM, i18n шапки, Prettier | Закрыт 16.08; адаптеры 5/12 enum |
| **Hotfix** | «Без ответа» 15 мин (`SLA_MINUTES`); стили консоли; 2FA 1 мин; GET вне общего rate limit | На диске `requestSla.ts`, `skipGlobalRateLimit` |

Корневой `openapi:check` — **зелёный** (188=188). Frontend lint в прошлой съёмке: 0 errors / 28 warnings (в этой сессии lint целиком не гонялся).

---

## 1. Резюме для руководства

Проект — **зрелый доменный продукт**: три роли, гибрид rule-based + LLM, заявки, запись, гараж, CMS, outbox, PDF, админка. Стек фронтенда актуален. Backend сильнее среднего Express: Zod на границах, Pino, graceful shutdown, circuit breaker, async-диагноз, отдельный worker, `src/` на TypeScript.

Главный разрыв **платформенный**: богатый контракт на хвосте OpenAPI, `noImplicitAny`, полный i18n кабинетов, PgBouncer. P0 по гейтам lint/OpenAPI закрыты в S6.

**Итоговая оценка зрелости: 8.0 / 10**

Итог — не среднее 22 доменов (**7.1**) и не заявленная траектория S30 (**9.4**). Это экспертная оценка готовности: пилот и рост команды без переписывания платформы — да; стандарт 2026 без оговорок — нет.

История заявленных баллов: 5.9 → 6.5 (S1–S3) → 6.8 (S4) → 7.0 (самооценка S5) → 6.6 (первая пересъёмка) → … → 9.2 (S29) → 9.4 (S30, заявлено) → **8.0 (пересъёмка 16.08)**.

### Что сильно

- Ролевой продукт с глубокими кабинетами; **53** lazy-маршрута.
- Пайплайн консультации: extraction / diagnosis, fallback, cache, case memory, feedback few-shot.
- Prisma: **41** миграция, `connection_limit=15`, optimistic concurrency заявок, pgvector HNSW.
- Compose tonight: live-проба 200, Redis AOF + volume, mem_limit, отдельный `worker`.
- Skip-link, `<main>`, Error Boundary, cookie-consent, шаблон 152-ФЗ, JSON-LD AutoRepair, sitemap/robots, PWA-иконки 192/512.
- k6 бьёт guest consultation + `/api/live`; job `perf` в CI. Eval: 38 rule-based сценариев.
- CRM: GENERIC_REST, ONE_C, BITRIX24, MOYSKLAD, GENERIC_WEBHOOK. SMS: smsru / http / log.
- «Без ответа»: **15 минут** (`SLA_MINUTES`), не 4 часа.

### Что ломает уверенность прямо сейчас

1. OpenAPI: 8 именованных схем; остальные ops — stub `{ type: object }`. `/api/v1` — alias, не версия контракта.
2. Backend: `noImplicitAny` / `strictNullChecks` выключены; тесты и seed — JS; роутеры 500–590 строк.
3. QueryClient только на `AdminIntegrationsPage`. i18n — 22 ключа шапки ru/en.
4. Coverage-порог Jest 50/40, не 70%. Lighthouse CI — warn. OTel collector — profile, по умолчанию не поднят.
5. Storybook CLI, PgBouncer, service worker, npm workspaces — нет.
6. Живой LLM eval: nightly fail-closed; в PR `LLM_ENABLED=false`.
7. 7 провайдеров CRM из enum 12 без адаптера (AmoCRM, YClients, MegaPlan, три AutoDealer, FILE_EXCHANGE).

---

## 2. Карта зрелости (повторная оценка)

| Домен | Было (исходный аудит) | Самооценка после S5 | **Сейчас** | Комментарий |
|------|------:|------:|------:|-------------|
| Архитектура | 6.5 | 7.1 | **8.6** | Фасады + CSS-слои + TS; `/api/v1` — alias |
| REST API | 4.5 | 6.6 | **6.9** | 188=188; 8 богатых схем; cursor на 2 ресурсах |
| Данные и Prisma | 7.0 | 7.2 | **7.5** | 41 миграция; pgvector HNSW; нет PgBouncer |
| Качество backend | 6.0 | 6.0 | **7.0** | 183 TS; тесты JS; `noImplicitAny` off |
| Качество frontend | 7.0 | 7.3 | **7.8** | TS strict; QueryClient на 1 странице |
| UI / UX | 7.5 | 7.7 | **8.4** | 73 CSS, max 641; MASTER primary `#ea580c` |
| Доступность | 6.0 | 7.0 | **7.0** | axe e2e 7 страниц; jsx-a11y warn; contrast off |
| Производительность | 6.0 | 6.3 | **6.5** | k6 в CI: 1 VU / 15 с; Lighthouse warn |
| Надёжность | 6.5 | 8.0 | **8.0** | live/ready 200 tonight; AOF; worker |
| Наблюдаемость | 4.0 | 6.4 | **6.7** | Prom + OTel SDK; collector — profile |
| Тестирование | 6.0 | 6.8 | **7.2** | 388 кейсов; 6 e2e; порог coverage 50/40 |
| CI/CD | 5.0 | 6.8 | **7.4** | k6 + Lighthouse + coverage upload |
| DevOps | 7.0 | 7.5 | **7.5** | Compose healthy; `render.yaml` deprecated |
| ИИ / LLM | 7.0 | 7.1 | **7.7** | Case memory ANN; prompt/completion в метриках |
| Интеграции | 5.5 | 6.2 | **7.1** | 5 из 12 enum; SMS smsru/http/log |
| Документация | 6.0 | 6.9 | **7.1** | LICENSE, ADR, CONTRIBUTING |
| DX | 4.5 | 5.1 | **6.1** | Prettier + Lefthook; нет workspaces |
| i18n | 3.0 | 3.0 | **4.4** | 22 ключа шапки; кабинеты RU |
| SEO / PWA | 4.5 | 6.0 | **6.4** | иконки 192/512; SW нет |
| Юридическая полнота | 7.0 | 7.0 | **7.0** | шаблон 152-ФЗ, cookies |
| Продуктовая аналитика | 3.0 | 5.3 | **5.9** | воронка + rum_web_vital; дашборда нет |
| Сопровождаемость | 5.5 | 5.9 | **8.3** | Фасады + слои + TS; роутеры 400–590 |

Среднее доменов **7.1**. Сильные ≥7: **15**. Средние 5.5–6.9: **6**. Слабые: **1** (i18n).

---

## 3. Архитектура и границы

### 3.1 Форма

Клиент-сервер: SPA → nginx `/api` → Express. Модули в `backend/src/modules/*`. Это правильный modular monolith.

Compose (проверено tonight): `frontend` (read_only, 512m, healthy) · `backend` (`RUN_BACKGROUND_JOBS=false`, migrate в CMD, 1g, healthy) · `worker` (тот же image, `node --import tsx src/worker.ts`, healthcheck `/tmp/worker-ready`, 1g, healthy) · `db` · `redis` (AOF `everysec`, `--requirepass`, volume `redisdata`) · `mailpit` (profile `mail`) · `otel-collector` (profile `observability`, **не поднят** в текущем `ps`).

Разделение процессов подтверждено логами: API пишет `server listening` без `diagnosis BullMQ worker started`; worker пишет старт BullMQ и `background worker listening (no http)`. Telegram-бот остаётся на API.

### 3.2 God-файлы (порог ~300–400 строк)

Фасады JS/TSX закрыты. CSS >700 закрыт. Хвост — **роутеры и сервисы backend >400**:

| Файл | Строк |
|------|------:|
| `backend/src/modules/users/security.service.ts` | 590 |
| `backend/src/modules/admin/admin.router.ts` | 589 |
| `backend/src/modules/consultations/consultations.router.ts` | 549 |
| `backend/src/modules/serviceRequests/serviceRequests.router.ts` | 518 |
| `backend/src/modules/auth/auth.service.ts` | 511 |
| `backend/src/modules/vehicles/vehicles.service.ts` | 498 |
| `backend/src/modules/users/users.router.ts` | 460 |
| `backend/src/modules/admin/admin.service.ts` | 404 |
| `frontend/src/styles/app/manager-workdesk.css` | 641 |
| `frontend/src/styles/app/booking-detail.css` | 622 |
| `frontend/src/styles/app/client-overview.css` | 605 |
| `frontend/src/styles/app/profile-security.css` | 602 |
| `frontend/src/styles/app/profile.css` | 581 |
| `frontend/src/styles/site/booking.css` | 516 |

**A-1 (P1).** CSS-монолит закрыт (S13–S28). Вид не менялся. CSS >700 нет. Хвосты кабинета ~600 — не god-файлы по правилу css-layers. Остаток P1-4 — роутеры 500+.

### 3.3 12-Factor (кроме security)

| Фактор | Статус |
|--------|--------|
| I Codebase | Один репозиторий, **не** git в этой копии; нет npm workspaces |
| II Dependencies | Три lockfile |
| III Config | Zod env; примеры расширены |
| IV Backing services | Postgres, Redis, SMTP, LLM URL |
| V Build/release/run | Multi-stage Docker; migrate в CMD API |
| VI Processes | HTTP и jobs разведены в Compose; локальный `npm start` по умолчанию поднимает jobs в API |
| VII Port binding | Express 3000, nginx 8080 |
| VIII Concurrency | Отдельный worker |
| IX Disposability | Graceful shutdown API и worker |
| X Dev/prod parity | Два backend-порта / две БД в dev — в ONBOARDING |
| XI Logs | Pino stdout + `trace_id` при OTel |
| XII Admin | seed / bootstrap-скрипты |

---

## 4. API

### 4.1 Сильное

- Ресурсные пути, Zod на многих роутерах.
- RFC 9457: `sendProblem`, `application/problem+json` (errorHandler, validate, idempotency). Поля `{ error, code }` ещё встречаются в части роутеров — двойной конверт.
- Инвентарь 188 + `npm run routes:check` в CI.
- `Idempotency-Key` (опциональный): POST contact, bookings (клиент/гость), создание консультации, guest service-request. Есть integration-тест.
- Пагинация заявок: `page` / `pageSize` (max 100) плюс cursor на bookings и `GET /consultations/staff`. `/api/v1` — rewrite-alias тех же маршрутов (не отдельный контракт).
- Пробы: `GET /api/live` (процесс), `/api/ready` (БД + Redis), `/api/health` = ready, `/api/metrics` Prometheus. Tonight `/api/live` — live. `isOperationalApiPath` не включает `/api/v1/live`; GET в общем лимитере пропускается (`skipGlobalRateLimit`).

### 4.2 Контракт (S6)

Генератор `sync-openapi.mjs` пишет `specs/001-ai-consultation-platform/contracts/openapi.yaml`. **188** operations, `openapi:check` зелёный (проверено tonight). Именованные схемы: Problem, ConsultationCreate, Consultation, BookingCreate, Booking, BookingList, ServiceRequest, CursorPage. Остальные тела — stub `{ type: object }`. Не OpenAPI 3.1 как источник истины для codegen.

**API-1 (P0) path-coverage** закрыт в S6. Остаток — богатые схемы на хвосте ops (P2). Контрактный тест `backend/tests/contract/openapi-schemas.test.js` есть.

---

## 5. Данные и PostgreSQL

- 41 миграция, lockfile, `migrate deploy` в образе API.
- UUID PK, индексы, `version` на заявках.
- `connection_limit=15` в `backend/src/lib/prisma.ts`.
- Embeddings: JSON + `embedding_vec` (pgvector HNSW cosine). JSON-скан в Node ограничен `CASE_MEMORY_MAX_SCAN` (S8).
- PgBouncer нет. При нескольких worker+API упрётесь в `max_connections`.
- Бэкап: `deploy/ops/backup-postgres.sh` копирует и Postgres, и том uploads (S2 подтверждён по наличию скрипта; прогон backup в этой сессии не выполнялся).

---

## 6. Качество backend

Плюсы: модули, `asyncHandler`, graceful shutdown, Zod env, Pino, отдельный `worker.ts` + `runtime/backgroundJobs.ts`. **S29:** `src/` на TypeScript, runtime `tsx`, `tsc --noEmit` в lint.

Минусы:

- Тесты и prisma seed ещё JavaScript; `noImplicitAny` / `strictNullChecks` выключены.
- ESLint без unicorn/n/cycles; **S6: 0 errors**. Frontend — 28 warnings (прошлый прогон).
- Prettier + Lefthook есть (S30); npm workspaces нет.
- Часть ответов всё ещё `res.status().json({ error })` в обход `sendProblem`.

---

## 7. Frontend, UI, состояние

### 7.1 Качество кода

Плюсы: TS `strict`, lazy router (53 `lazy(`), Error Boundary + unit-тест, Vitest coverage в CI (`CI=true`).

Минусы: клиентский API `as T` без runtime-схемы; TanStack Query только на `AdminIntegrationsPage` (остальное — ручной fetch/поллинг). 2FA не отдельный маршрут: challenge в `LoginPage`, настройка в `ProfileSecurityPanel`. `usePageMeta` ставит title/description на страницах; OG-теги в `index.html` глобальные, не по маршруту.

Frontend lint: **0 errors, 28 warnings** (в т.ч. jsx-a11y и exhaustive-deps). Для CI при `max warnings` это зелёный, в отличие от backend.

### 7.2 UI / UX

Плюсы: тёмная/светлая тема, токены, skip-link, command palette, cookie banner, legal pages, ProductConfig.

CSS: механический распил без смены визуала. Бандл сборки **~415 KB** CSS до gzip — главный вес, импорт всё равно целиком из `main.tsx`.

`design-system/autoservice-ai/MASTER.md`: текст «orange CTA, navy не бренд», но spec кнопки `.btn-primary { background: #0369A1 }`. Документ системы **частично** источник правды.

Нет Storybook CLI в зависимостях. Есть CSF `Button.stories`. `ui-review.spec.js` — скриншоты, не регрессия.

### 7.3 Состояние и realtime

Поллинг кабинетов. SSE консультации есть; nginx `proxy_buffering off` для `/api/` подтверждён спринтом 1 (файлы `frontend/docker/default.conf`, `deploy/nginx/*` не перечитывались побайтово в этой сессии — считаем закрытым, пока не опровергнуто). LLM `stream: false` — SSE это этапы пайплайна, не token stream.

### 7.4 i18n, SEO, PWA

- i18n: `frontend/src/i18n/messages.ts`, **22 ключа** шапки ru/en. Кабинеты и формы — русский в коде.
- JSON-LD `AutoRepair` только на HomePage. `robots.txt` (Disallow `/dashboard`, `/login`, `/register`), `sitemap.xml` (9 публичных URL), `manifest.webmanifest` + `icon-192.png` / `icon-512.png`.
- SPA без SSR. Service worker нет. Installability PWA не закрыта (нет SW).

---

## 8. Доступность (WCAG 2.2 AA)

Сделано и подтверждено:

- `lang="ru"`, skip-link → `#main-content` / `#dashboard-main`.
- `<main id="dashboard-main">`.
- `eslint-plugin-jsx-a11y` на **warn**.
- `tests/e2e/a11y-critical.spec.js`: home, consult, login, booking, register, client overview, manager queue. Теги wcag2a/aa/22aa. **`color-contrast` выключен.** Серьёзные/критичные violation — гейт.
- `prefers-reduced-motion`. Modal: focus trap был подтверждён исходным аудитом.

Не сделано: contrast в гейте, keyboard-only project, target size 2.2 на плотных таблицах. Mobile Playwright: **есть** `public-mobile-smoke.spec.js` (Pixel 7), не полный набор страниц.

**Оценка 7.0** — есть гейт, нет полной WCAG-программы.

---

## 9. Производительность

Frontend: vendor chunk, lazy, font subset, nginx immutable assets. RUM: `frontend/src/lib/rum.ts` → `rum_web_vital`. Lighthouse CI: job `lighthouse`, уровень **warn**. CSS ~415 KB — LCP-риск.

Backend: кэш диагноза, async job, compression. Cosine по JSON embeddings + pgvector. Таймаут диагноза до 240 с. k6: скрипт консультации; в CI job `perf` гоняет **1 VU / 15 с** smoke (`K6_VUS=1 K6_DURATION=15s`), не полноценную нагрузку.

---

## 10. Надёжность и эксплуатация

Сильное: healthcheck всех сервисов включая worker; `restart: unless-stopped`; read_only frontend; graceful shutdown; LLM fallback; backup скрипты; mem_limit.

Слабое:

- `render.yaml` помечен deprecated (ADR-0002). Дрейф к Compose закрыт документально.
- OTel collector в Compose есть как profile `observability`; **не запущен** в текущем `docker compose ps`.
- SLA/reminders/outbox — `setInterval` внутри worker, не отдельный scheduler. Порог «без ответа»: **15 минут**.
- Healthcheck worker — только `test -f /tmp/worker-ready`, без ping БД/Redis/очереди.
- В `.env.example` есть `OTEL_*` и SMS. `.env.production.example` содержит `STAFF_2FA_REQUIRED` и SMS. Upload-пути и `DEMO_*_PASSWORD` по-прежнему читаются из `process.env` вне Zod.
- `docs/proxmox-selfhost.md` в дереве **нет** (старая находка про ollama-дрейф снята вместе с файлом). Актуальный how-to — `docs/deploy.md`.

---

## 11. Наблюдаемость

| Столп | Факт |
|-------|------|
| Logs | Pino JSON; `trace_id` при живом SDK |
| Metrics | `GET /api/metrics` Prometheus (HTTP RED + LLM snapshot). In-memory snapshot админки **оставлен** |
| Traces | `instrument.js` NodeSDK + auto-instrumentations; OTLP если есть endpoint; без endpoint — SDK без exporter |
| Profiling | Нет |
| Error tracking | Нет Sentry/GlitchTip |
| SLO | Нет алерта p95 диагноза |

Collector в Compose: сервис `otel-collector`, profile `observability` — **не запущен** tonight. Диагностика «90 секунд диагноза — где?» без профиля требует внешний OTLP. RUM web-vitals пишутся как продуктовое событие.

---

## 12. Тестирование

| Уровень | Факт |
|---------|------|
| Backend unit + integration + eval + security | 63 файла, 227 кейсов |
| Frontend Vitest | 44 файла, 161 кейс; coverage при `CI=true`, **без порогов Vitest** |
| E2E | 6 spec: migration-flow, admin-nav-smoke, ui-review, ai-timeout, a11y-critical, **public-mobile-smoke** (Pixel 7). Chromium + mobile-chrome |
| Perf | k6 консультация; в CI job `perf` (1 VU / 15 с) |
| Eval | 38 JSON, rule-based `preAnalyzeSymptoms`; `passed >= 30`. Дубликат `scenarios.json` в `src/modules/eval` и `tests/eval` |

CI e2e: Postgres + Redis + migrate + seed + Playwright; `reuseExistingServer: !CI`. P0 «e2e без backend» закрыт.

Coverage backend: lines/statements 50, branches/functions 40 — в CI. Upload артефактов **есть** (`backend-coverage`, `frontend-coverage`).

Слабо: остальные CRM-адаптеры, serviceRecords, jobs, vision, embeddings indexer, менеджерский/админ UI как страницы, гараж, 2FA-страница.

Контрактный тест схем OpenAPI есть; большинство ops всё ещё stub.

Backend lint errors в `tests/integration/service-request-pdf.test.js` — **сняты в S6** (не тащить в текущий реестр).

---

## 13. CI/CD

`.github/workflows/ci.yml`: lint (включая routes:check **и openapi:check**), build, test-backend (Postgres), test-frontend, e2e (Postgres+Redis), security (audit, SBOM, Trivy exit 0), CodeQL, TruffleHog.

Плюсы относительно исходного аудита: `concurrency`, Dependabot (npm ×3 + actions + docker), Playwright artifact, Redis в e2e, Node 22.

Минусы относительно стандарта 2026 (гейты lint/openapi в S6 зелёные):

- Coverage upload есть; **порог 70% не поднят**.
- k6 в CI — smoke 1 VU / 15 с, не нагрузочный прогон.
- Lighthouse CI — warn, не fail.
- Три `npm ci` без workspaces.

---

## 14. ИИ-консультация

Пайплайн сильный: structured diagnostics, JSON schema, merge, OBD, case memory, feedback few-shot, vision-заготовка, async BullMQ, `PROMPT_VERSION = consultation-prompts.v1`.

| Практика LLMOps 2026 | Статус |
|----------------------|--------|
| Offline eval (rules) | 38 сценариев |
| Live model eval / LLM-as-judge | Nightly extraction+diagnosis (10 кейсов, порог 80%); fail-closed без ключа; не LLM-as-judge; e2e без LLM |
| Версия промпта в логах/метриках | Константа в файле, не телеметрия |
| Token accounting | prompt/completion в Prometheus snapshot |
| RAG | pgvector HNSW + JSON fallback с лимитом скана |
| Tracing gen-ai | Общий OTel HTTP; нет Langfuse |
| Цель p95 ≤ 45 с | Таймаут 240 с |

Конституция v1.1.0 (amended 2026-08-15): облачная LLM **разрешена**. Остаётся конфликт: «white is the primary background» vs тёмная тема по умолчанию.

---

## 15. Интеграции, уведомления, контент

Модель CRM (connections, jobs, outbox, cursors) богатая. Enum **12** провайдеров. Реестр адаптеров S30: **GENERIC_REST, ONE_C, BITRIX24, MOYSKLAD, GENERIC_WEBHOOK** (5/12). Без адаптера: AUTODEALER_DESKTOP/WEB/ONLINE, AMOCRM, YCLIENTS, MEGAPLAN, FILE_EXCHANGE. Живой прогон против Bitrix/МойСклад в этой сессии не выполнялся.

Outbox: стабильный ключ, drain каждые 3 с в worker, не на hot path HTTP.

Уведомления: inbox, Telegram, booking reminders, SLA 15 мин. SMS: `smsru` / `http` / `log` (`isSmsConfigured`).

CMS достаточна для white-label сайта.

---

## 16. Документация (Diátaxis)

| Тип | Есть | Качество |
|-----|------|----------|
| Tutorial | `docs/ONBOARDING.md` | Высокое |
| How-to | `docs/deploy.md`, `docs/demo.md` | Актуальны (worker в таблице Compose) |
| Reference | инвентарь JSON; OpenAPI YAML 188 ops; Prisma schema | Контракт есть |
| Explanation | `docs/architecture.md` | Синхронизирован с worker/OTel |
| Constitution | `.specify/memory/constitution.md` v1.1.0 | LLM ок; белый фон — нет |
| Журнал | `CHANGELOG.md` | Есть; S30 + hotfix 15 мин |
| Спеки | `specs/001-ai-consultation-platform/contracts/openapi.yaml` | На диске |

Есть LICENSE, CONTRIBUTING, ADR-0001/0002. `docs/setup.md` нет. Security-доки есть, в знаменатель этого аудита не входят.

---

## 17. Developer Experience

Нет: workspaces, Storybook CLI, codegen клиента, devcontainer.

Есть: `.nvmrc`/engines `>=22`, ONBOARDING, `llm:check`, `routes:inventory`, `openapi:check` зелёный, Prettier, Lefthook, `format` / `format:check`.

---

## 18. Юридическая и продуктовая полнота (не security)

152-ФЗ шаблон, оферта, cookie-категории, consent на формах, юр. тексты в CMS. Это комплектность артефактов, не правовая экспертиза. Аналитические cookie не подключены к трекеру.

События: `consult_started`, `diagnosis_shown`, `request_created`, `booking_confirmed`, `rum_web_vital` → `POST /api/product-events`. Lighthouse CI warn. Feature flags — только env.

---

## 19. Конституция (кроме security)

| Обязательство | Факт |
|---------------|------|
| Клиент-сервер, REST, PostgreSQL | Да |
| Три роли и кабинеты | Да |
| Структурированная диагностика | Да |
| Сайт: home, gallery, works, location, services, consult | Да (+ about/booking) |
| Telegram по заявке | Да |
| Тестовые уровни | Формально да; k6/LH в CI (smoke/warn); lint/openapi зелёные |
| Локальная LLM | Разрешено облако (v1.1.0) |
| Белый фон, оранжево-чёрный акцент | Тёмная тема по умолчанию; бренд оранжевый; MASTER primary `#ea580c` |

---

## 20. Реестр находок (повторная оценка)

### P0

| ID | Находка | Домен | Статус |
|----|---------|-------|--------|
| P0-1 | CI e2e без backend | Тесты | ✅ S1, e2e поднимает API |
| P0-2 | Redis без AOF при async-диагнозе | Надёжность | ✅ S1 |
| P0-3 | OpenAPI не покрывает маршруты | API | ✅ S6 YAML 188 ops + `openapi:check`; 8 богатых схем |
| P0-4 | Корневой lint / `openapi:check` красные | CI / DX | ✅ S6 |

### P1

| ID | Находка | Статус |
|----|---------|--------|
| P1-1 | Нет OTel / метрик | ✅ traces + Prometheus; collector — Compose profile `observability` |
| P1-2 | Mixed health | ✅ live/ready |
| P1-3 | Nginx буфер SSE | ✅ (S1) |
| P1-4 | God-файлы JS/TSX и CSS | ◐ S7–S28: фасады и CSS-слои; CSS >700 закрыт; роутеры 500–590 |
| P1-5 | Backend JS, слабый ESLint | ◐ S29 TS + S30 Prettier/Lefthook; тесты JS; `noImplicitAny` выключен |
| P1-6 | Error Boundary | ✅ |
| P1-7 | Eval без живой LLM; k6 | ✅ S14 nightly + S30 k6 в CI |
| P1-8 | Один CRM-адаптер при enum из 12 | ◐ S30: GENERIC_REST, ONE_C, BITRIX24, MOYSKLAD, GENERIC_WEBHOOK |
| P1-9 | jsx-a11y / axe | ✅ axe e2e; jsx-a11y warn; contrast off |
| P1-10 | Embeddings JSON, нет pgvector | ✅ S8 pgvector + `CASE_MEMORY_MAX_SCAN` |
| P1-11 | MASTER vs токены | ✅ S6 primary `#ea580c` |
| P1-12 | Конституция vs продукт | ◐ LLM облако ок; белый фон нет |
| P1-13 | Playwright: один браузер, нет mobile | ✅ S30 Pixel 7 smoke |
| P1-14 | Coverage 40–50% | ◐ пороги те же; upload артефактов в CI |

### P2

| ID | Находка | Статус |
|----|---------|--------|
| P2-1 | Нет v1 / cursor / Idempotency | ✅ `/api/v1` alias; cursor на bookings и consultations/staff |
| P2-2 | Offset-пагинация до 500 | ◐ cursor рядом с offset |
| P2-3 | Worker в процессе API | ✅ Compose `worker`; SLA на setInterval внутри worker |
| P2-4 | Нет TanStack Query / SSR meta | ◐ QueryClient + интеграции; SSR meta нет |
| P2-5 | Нет i18n | ◐ ru/en шапка; кабинеты RU |
| P2-6 | SEO / PWA | ◐ sitemap/robots/JSON-LD; иконки 192/512; SW нет |
| P2-7 | CI hygiene | ✅ coverage artifacts; k6; Lighthouse |
| P2-8 | Нет mem_limit | ✅ |
| P2-9 | render.yaml / architecture.md | ✅ `render.yaml` deprecated; ADR-0002 |
| P2-10 | Два backend-порта в dev | ✅ Vite 5173 проксирует `/api` на 3000 — так задумано |
| P2-11 | Продуктовые события / RUM | ✅ rum_web_vital |
| P2-12 | Storybook / визуальная регрессия | ◐ CSF Button.stories; CLI Storybook не в зависимостях |
| P2-13 | PgBouncer | ◐ connection_limit=15 |
| P2-14 | ADR, LICENSE, CHANGELOG, CONTRIBUTING | ✅ |
| P2-15 | Промпты / токены | ✅ prompt/completion в llm metrics |
| P2-16 | Бэкап без uploads | ✅ |
| P2-17 | `.env.production.example` / `.env.example` vs Zod | ✅ STAFF_2FA / SMS / vision / guest TTL |
| P2-18 | Outbox key с Date.now() | ✅ |
| P2-19 | markDiagnosisJobFailed | ✅ |
| P2-20 | `#dashboard-main` не main | ✅ |
| P2-21 | Outbox на HTTP | ✅ poller |
| P2-22 | Redis в CI | ✅ e2e |
| P2-23 | `docs/README` → несуществующий `specs/` | ✅ S6 ссылка на сгенерированный OpenAPI |

### P3

| ID | Находка | Статус |
|----|---------|--------|
| P3-1 | engines >=20 vs 22 | ✅ `>=22` |
| P3-2 | setup.md дублирует ONBOARDING | ✅ файла нет |
| P3-3 | Manifest icon 64×64 | ✅ 192 + 512 PNG |
| P3-4 | Нет noUncheckedIndexedAccess | ☐ |
| P3-5 | Feature flags только env | ☐ |
| P3-6 | Analytics в primary DB | ☐ |
| P3-7 | Мёртвые страницы вне роутера | ✅ S12 удалены `ClientConsultationsPage`, `ClientRequestsPage`, `ClientRequestDetailPage` |
| P3-8 | SSE — этапы, не token stream | ☐ (осознанно) |
| P3-9 | SMS-заглушка | ✅ smsru / http / log |
| P3-10 | Клиентский API без runtime-схемы | ☐ |

---

## 21. Дорожная карта (90 дней, без security)

Приоритет — платформа после честных гейтов. Спринты 1–30 закрыли дни 1–45 почти целиком.

### Дни 1–7 — починить ложную уверенность → **S6, сделано**

1. ✅ Восстановить `openapi.yaml` (`npm run openapi:sync`); `openapi:check` зелёный (188 ops).
2. ✅ Закрыть ошибки ESLint backend; корневой `npm run lint` зелёный (прошлый прогон).
3. ✅ `docs/README.md` указывает на сгенерированный контракт.
4. ✅ MASTER `.btn-primary` — `#ea580c`.

### Дни 8–45 → **S7–S30, сделано с хвостом**

5. ◐ Богатые схемы OpenAPI на консультацию/заявки/запись + контрактный тест. Schemathesis nightly нет. Хвост ops — stub.
6. ✅ Фасады flow/заявок/AI/consultations/extract; Consult/гараж/Booking/ManagerRequest; CSS-слои; backend `src/` на TypeScript. CSS >700 закрыт.
7. ✅ pgvector HNSW + `CASE_MEMORY_MAX_SCAN`.
8. ◐ Coverage upload в CI; порог 70% не поднят (50/40).
9. ◐ OTel collector в Compose (profile); по умолчанию не поднят.

### Дни 45–90 — остаток

10. ✅ Live LLM eval nightly (extraction+diagnosis, fail-closed, не в PR).
11. ◐ CRM: 5 адаптеров из 12.
12. ✅ `/api/v1` alias + cursor на bookings и consultations/staff.
13. ◐ Prettier + Lefthook; workspaces нет.
14. ◐ i18n шапки; TanStack Query на 1 странице.
15. ◐ RUM + Lighthouse CI warn.

Оценка остатка: **1 сильный full-stack ~ 2–4 недели** на noImplicitAny, i18n кабинетов, остальные CRM и богатые схемы; не смешивать с фичами кабинетов.

---

## 22. Приложение A. Модули backend

auth · users · consultations / consultationAi / consultationFlow · serviceRequests · requestMessages · completionDocuments · bookings · vehicles / serviceRecords · admin / siteSettings / content · analytics · integrations (GENERIC_REST, ONE_C, BITRIX24, MOYSKLAD, GENERIC_WEBHOOK) · notifications · contact · eval · jobs (SLA 15 мин, reminders, guest TTL, outbox) · worker runtime.

## 23. Приложение B. Тесты (сводка)

**Frontend 44 файла / 161 кейс:** api client, auth, формы, Consult/Booking, SSE, cookieConsent, client-cases, Error Boundary, ошибки, labels. Нет page-тестов `pages/manager/` и `pages/admin/` (кроме e2e smoke/a11y очереди). Гараж и `ProfileSecurityPanel` без page-тестов. Coverage в CI собирается, порогов Vitest нет.

**Backend 63 файла / 227 кейсов:** auth/otp/sessions, consultation (+ stream, AI, access, observability), service-requests (concurrency, pdf, messages, completion), bookings, admin, analytics, contact, telegram, notifications, health, product-events, idempotency, problem details, openapi-schemas.

**E2E 6 spec** (включая Pixel 7 smoke). **Eval 38** rule-based. **k6** консультация, в CI как 1 VU / 15 с.

## 24. Приложение C. Не аудировали

- Пентест и threat model — отдельный `docs/SECURITY-AUDIT-2026-08-15.md`.
- Нагрузочный прогон k6 на живом демо — скрипт прочитан, в CI гоняется smoke 1 VU; полный прогон не запускался.
- Lighthouse по `autoservice-demo.zernov.online` — CI warn-конфиг есть, живой балл демо в этой сессии не снимался.
- Юридическая сила 152-ФЗ.
- Качество конкретной облачной модели.

---

## 25. Заключение

Спринты 1–30 закрыли пробы, Redis, worker, CSS-слои, axe, OTel SDK, события воронки, гейты lint/OpenAPI, фасады, pgvector, TypeScript backend src, CRM×5, SMS, `/api/v1`, cursor, k6/LH в CI, RUM, i18n шапки, Prettier. Hotfix tonight: порог «без ответа» 15 минут.

Заявленный **9.4** — арифметика спринтов. Пересъёмка диска: **8.0 / 10**. Среднее доменов 7.1. P0 закрыты. P1 полностью открытых нет.

Если цель — демо: **достаточно**.  
Если цель — стандарт 2026 без security-трека: ещё квартал на §27, не на CSS-распил.

---

## 26. Сверка с предыдущим текстом аудита

Тело исходного документа (до пересъёмок) содержало **устаревшие утверждения**, уже закрытые спринтами: «нет jsx-a11y / axe», «dashboard-main — div», «нет sitemap/JSON-LD», «k6 бьёт /users/me», «нет concurrency/Dependabot», «нет traces», «137 JS / 22 CSS / 40 миграций», «нет LICENSE». Они **не** описывают текущий код. Этот файл заменяет их фактическим состоянием 16.08.2026.

Не подтверждено и в реестр не возвращалось: «Modal без focus trap».

S30 **9.4** в этом файле остаётся в журнале траектории как заявленная самооценка, не как итог пересъёмки.

---

## 27. Бэклог после пересъёмки 16.08

P0 закрыты. P1 полностью открытых нет. Не смешивать остаток с фичами кабинетов.

| Приоритет | Что осталось |
|-----------|----------------|
| P1 | `noImplicitAny` / `strictNullChecks` на backend; остальные 7 CRM из enum; распил роутеров 500+ |
| P2 | Полный i18n кабинетов; Storybook CLI; PgBouncer; service worker; богатые схемы на хвосте OpenAPI; coverage 70% |
| P3 | Feature flags; отдельная analytics DB; runtime-схемы клиентского API; `noUncheckedIndexedAccess` |

Следующее, если понадобится: ужесточение TypeScript backend или white-label i18n — не новый CSS-спринт.
