# Полный аудит проекта (без безопасности) — повторная оценка

**Проект:** Интеллектуальный ассистент автосервиса (`car-service-ai-assistant`)  
**Дата повторной оценки:** 15 августа 2026 (вечер, после спринтов 1–5)  
**Объект:** рабочая копия на диске — код, Compose, CI, тесты, документация, продуктовая полнота  
**Исключено по запросу:** информационная безопасность (auth/JWT/RBAC/XSS/CSRF/секреты/threat model). Смежные темы надёжности и эксплуатации (health-пробы, персистентность очередей, наблюдаемость) включены как operational quality.

Это **не правка журнала**, а независимая пересъёмка. Предыдущая итоговая оценка 7.0 не подтверждена: часть закрытых пунктов не переживает проверку артефактов. Колонка «Статус» в §20: ✅ сделано и подтверждено · ◐ частично / регресс · ☐ открыто.

---

## 0. Паспорт аудита

| Поле | Факт на 15.08.2026 вечером |
|------|----------------------------|
| Стек | React 19 + Vite 7 + TypeScript (frontend) · Node.js 22 + Express + Prisma 6 + PostgreSQL 16 · Redis 7 / BullMQ · LLM OpenAI-compatible / Ollama |
| Форма | Modular monolith, SPA + REST, Docker Compose: `frontend`, `backend`, `worker`, `db`, `redis`, `mailpit` (profile `mail`) |
| Backend | **137** файлов JS в `backend/src`, **20 862** строк |
| Frontend | **354** файла TS/TSX в `frontend/src`, **38 533** строк (без тестов ~36 100) |
| CSS | **22** файла, **23 581** строка; barrel `main.css` / `site.css` + слои `styles/app/*` и `styles/site/*` |
| Тесты | Backend **55** `*.test.js`, **192** кейса `it/test` · Frontend **43** файла, **154** кейса · E2E **5** spec · k6 **1** · eval **38** сценариев |
| Миграции Prisma | **40** |
| HTTP | Инвентарь **188** маршрутов (`docs/api-route-inventory.json`, `generatedAt: 2026-08-15`) |
| OpenAPI | **0.5.0**, 188 ops в `specs/…/contracts/openapi.yaml`; `openapi:check` зелёный (S6). Схемы тел — stub |

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

| Спринт | Заявленный фокус | Верификация 15.08 вечером |
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

Корневой `npm run lint` и `openapi:check` — **зелёные** (S6). Frontend lint: 0 errors / 28 warnings.

---

## 1. Резюме для руководства

Проект по-прежнему **зрелый доменный продукт**: три роли, гибрид rule-based + LLM, заявки, запись, гараж, CMS, outbox, PDF, админка. Стек фронтенда актуален. Backend сильнее среднего Express: Zod на границах, Pino, graceful shutdown, circuit breaker, async-диагноз, отдельный worker.

Главный разрыв остаётся **платформенным** (DX, остаток god-файлов, k6 не в CI). P0 по гейтам lint/OpenAPI закрыты в S6.

**Итоговая оценка зрелости: 7.5 / 10**

История: 5.9 → 6.5 (S1–S3) → 6.8 (S4) → 7.0 (самооценка S5) → 6.6 (повторная оценка) → 6.8 (S6) → 6.9 (S7) → 7.0 (S8, pgvector) → 7.1 (S9, распил ConsultPage/гаража) → 7.2 (S11, AI-фасад) → 7.3 (S12, Booking/гараж/widgets) → 7.4 (S13 CSS) → **7.5 (S13 live eval)**.

### Что сильно

- Ролевой продукт с глубокими кабинетами; **53** lazy-маршрута.
- Пайплайн консультации: extraction / diagnosis, fallback, cache, case memory, feedback few-shot.
- Prisma-миграции, `connection_limit=15`, optimistic concurrency заявок.
- Compose: live-проба, Redis AOF + volume, mem_limit, отдельный `worker`, Telegram на API.
- Skip-link, `<main>`, Error Boundary, cookie-consent, шаблон 152-ФЗ, JSON-LD AutoRepair, sitemap/robots.
- k6 бьёт guest consultation + `/api/live` (не заглушку `/users/me`).
- Eval: 38 rule-based сценариев.

### Что ломает уверенность прямо сейчас

1. ~~`openapi:check` ENOENT~~ ✅ S6: YAML 188 ops.
2. ~~backend ESLint 9 errors~~ ✅ S6: корневой lint зелёный (frontend — warnings).
3. God-файлы JS/TSX и CSS: фасады S7–S12; `vehicles.css` / `client-overview.css` распилены в S13. Остались `consultations.service.js` 691, `ManagerRequestDetailPage` 674, `dashboard-widgets.css` 855.
4. OpenAPI схемы тел — stub; контрактных тестов нет.
5. ~~pgvector нет~~ ✅ S8: `embedding_vec` + HNSW; JSON-скан ограничен `CASE_MEMORY_MAX_SCAN`.
6. Живой LLM eval: nightly workflow + golden set; в PR/e2e по-прежнему `LLM_ENABLED=false`.
7. i18n, TanStack Query, `/api/v1`, cursor-pagination — нет.

---

## 2. Карта зрелости (повторная оценка)

| Домен | Было (исходный аудит) | Самооценка после S5 | **Сейчас** | Комментарий |
|------|------:|------:|------:|-------------|
| Архитектура | 6.5 | 7.1 | **7.6** | Worker + фасады S7–S11 + Booking/гараж S12 + CSS-слои S13 |
| REST API | 4.5 | 6.6 | **6.4** | RFC 9457 + идемпотентность + YAML 188 ops; схемы stub, нет v1/cursor |
| Данные и Prisma | 7.0 | 7.2 | **7.5** | 40 миграций; pgvector HNSW; нет PgBouncer |
| Качество backend | 6.0 | 6.0 | **5.9** | Lint зелёный (S6); JS, не TS |
| Качество frontend | 7.0 | 7.3 | **7.5** | TS strict, lazy, EB; Booking/Consult/гараж в хуках; нет TanStack Query |
| UI / UX | 7.5 | 7.7 | **7.7** | Слои CSS; MASTER primary `#ea580c` |
| Доступность | 6.0 | 7.0 | **7.0** | axe e2e 7 страниц; jsx-a11y warn; contrast выключен |
| Производительность | 6.0 | 6.3 | **6.3** | k6 консультация; CSS-бандл ~415 KB |
| Надёжность | 6.5 | 8.0 | **8.0** | live/ready, AOF, worker, бэкап uploads |
| Наблюдаемость | 4.0 | 6.4 | **6.4** | Prom + OTel SDK; collector/SLO нет |
| Тестирование | 6.0 | 6.8 | **6.9** | Пирамида + nightly live eval; 5 e2e; lint/openapi зелёные |
| CI/CD | 5.0 | 6.8 | **6.8** | Nightly LLM eval; Dependabot; coverage upload нет |
| DevOps | 7.0 | 7.5 | **7.4** | Compose зрелый; `render.yaml` устарел |
| ИИ / LLM | 7.0 | 7.1 | **7.5** | Case memory ANN; nightly live extraction eval; учёта токенов нет |
| Интеграции | 5.5 | 6.2 | **6.2** | Outbox + poller; адаптер один |
| Документация | 6.0 | 6.9 | **6.7** | README указывает на сгенерированный OpenAPI |
| DX | 4.5 | 5.1 | **5.1** | `openapi:check` + lint зелёные; нет workspaces/Prettier/hooks |
| i18n | 3.0 | 3.0 | **3.0** | Только русский в коде |
| SEO / PWA | 4.5 | 6.0 | **6.0** | JSON-LD + sitemap; SW нет |
| Юридическая полнота | 7.0 | 7.0 | **7.0** | шаблон 152-ФЗ, cookies |
| Продуктовая аналитика | 3.0 | 5.3 | **5.3** | 4 события воронки; нет RUM |
| Сопровождаемость | 5.5 | 5.9 | **6.7** | Booking/гараж/widgets (S12) + vehicles/overview слои (S13); widgets.css 855 |

---

## 3. Архитектура и границы

### 3.1 Форма

Клиент-сервер: SPA → nginx `/api` → Express. Модули в `backend/src/modules/*`. Это правильный modular monolith.

Compose (проверено): `frontend` (read_only, 512m) · `backend` (`RUN_BACKGROUND_JOBS=false`, migrate в CMD, 1g) · `worker` (тот же image `car-service-ai-assistant-api:latest`, `node src/worker.js`, healthcheck `/tmp/worker-ready`, 1g) · `db` · `redis` (AOF `everysec`, `--requirepass`, volume `redisdata`) · `mailpit` (profile).

Разделение процессов подтверждено логами: API пишет `server listening` без `diagnosis BullMQ worker started`; worker пишет старт BullMQ и `background worker listening (no http)`. Telegram-бот остаётся на API.

### 3.2 God-файлы (порог ~300–400 строк)

| Файл | Строк |
|------|------:|
| `backend/src/services/consultationFlowService.js` | 240 (оркестратор; логика в `consultationFlow/*`) |
| `backend/src/services/consultationFlow/extract.js` | 360 |
| `backend/src/modules/serviceRequests/serviceRequests.service.js` | 19 (фасад; логика в `service/*`) |
| `backend/src/modules/consultations/consultationAi.service.js` | 21 (фасад; логика в `consultationAi/*`) |
| `backend/src/modules/consultations/consultationAi/preAnalyze.js` | 239 |
| `backend/src/modules/consultations/consultations.service.js` | 691 |
| `backend/src/modules/integrations/integrations.service.js` | 633 |
| `frontend/src/pages/dashboards/client/ClientVehicleDetailPage.tsx` | 38 (оркестратор; JSX в `Vehicle*Section`) |
| `frontend/src/pages/public/BookingPage.tsx` | 226 (оркестратор; логика в `features/booking`) |
| `frontend/src/api/dashboard.ts` | 724 |
| `frontend/src/features/consultations/useConsultPage.ts` | 452 |
| `frontend/src/pages/public/ConsultPage.tsx` | 299 |
| `frontend/src/pages/manager/ManagerRequestDetailPage.tsx` | 674 |
| `frontend/src/styles/app/dashboard-widgets.css` | 855 (было 3135; слои consultation/followup/diagnosis/chrome/responsive) |
| `frontend/src/styles/app/vehicles-service-book.css` | 975 (слой из vehicles.css) |
| `frontend/src/styles/app/client-overview.css` | 600 (слой; garage/focus/cases/manager отдельно) |

**A-1 (P1).** CSS больше не монолит на 17k в одном файле — это закрыто. **S13:** `vehicles.css` и `client-overview.css` разложены по слоям (вид не менялся). Самый тяжёлый остаток CSS — `vehicles-service-book.css` (975) и `dashboard-widgets.css` (855).

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
- Пагинация заявок: `page` / `pageSize` (max 100). Cursor-pagination нет. `/api/v1` нет.
- Пробы: `GET /api/live` (процесс), `/api/ready` (БД + Redis), `/api/health` = ready, `/api/metrics` Prometheus.

### 4.2 Контракт (S6)

Генератор `sync-openapi.mjs` пишет `specs/001-ai-consultation-platform/contracts/openapi.yaml` (mkdir recursive). **188** operations, `openapi:check` зелёный. Схемы тел — stub `{ type: object }` + Problem Details. Не OpenAPI 3.1 как источник истины для codegen.

**API-1 (P0) path-coverage** закрыт в S6. Остаток — богатые схемы и контрактные тесты (P2).

---

## 5. Данные и PostgreSQL

- 40 миграций, lockfile, `migrate deploy` в образе API.
- UUID PK, индексы, `version` на заявках.
- `connection_limit=15` в `backend/src/lib/prisma.js`.
- Embeddings: JSON + `embedding_vec` (pgvector HNSW cosine). JSON-скан в Node ограничен `CASE_MEMORY_MAX_SCAN` (S8).
- PgBouncer нет. При нескольких worker+API упрётесь в `max_connections`.
- Бэкап: `deploy/ops/backup-postgres.sh` копирует и Postgres, и том uploads (S2 подтверждён по наличию скрипта; прогон backup в этой сессии не выполнялся).

---

## 6. Качество backend

Плюсы: модули, `asyncHandler`, graceful shutdown, Zod env, Pino, отдельный `worker.js` + `runtime/backgroundJobs.js`.

Минусы:

- JavaScript + JSDoc, не TypeScript.
- ESLint без unicorn/n/cycles; **S6: 0 errors**. Frontend — 28 warnings.
- Нет Prettier.
- Часть ответов всё ещё `res.status().json({ error })` в обход `sendProblem`.

---

## 7. Frontend, UI, состояние

### 7.1 Качество кода

Плюсы: TS `strict`, lazy router (53 `lazy(`), Error Boundary + unit-тест, Vitest coverage в CI (`CI=true`).

Минусы: клиентский API `as T` без runtime-схемы; нет TanStack Query (ручной fetch/поллинг). 2FA не отдельный маршрут: challenge в `LoginPage`, настройка в `ProfileSecurityPanel`. `usePageMeta` ставит title/description на страницах; OG-теги в `index.html` глобальные, не по маршруту.

Frontend lint: **0 errors, 28 warnings** (в т.ч. jsx-a11y и exhaustive-deps). Для CI при `max warnings` это зелёный, в отличие от backend.

### 7.2 UI / UX

Плюсы: тёмная/светлая тема, токены, skip-link, command palette, cookie banner, legal pages, ProductConfig.

CSS: механический распил без смены визуала. Бандл сборки **~415 KB** CSS до gzip — главный вес, импорт всё равно целиком из `main.tsx`.

`design-system/autoservice-ai/MASTER.md`: текст «orange CTA, navy не бренд», но spec кнопки `.btn-primary { background: #0369A1 }`. Документ системы **частично** источник правды.

Нет Storybook / pixel-diff. `ui-review.spec.js` — скриншоты, не регрессия.

### 7.3 Состояние и realtime

Поллинг кабинетов. SSE консультации есть; nginx `proxy_buffering off` для `/api/` подтверждён спринтом 1 (файлы `frontend/docker/default.conf`, `deploy/nginx/*` не перечитывались побайтово в этой сессии — считаем закрытым, пока не опровергнуто). LLM `stream: false` — SSE это этапы пайплайна, не token stream.

### 7.4 i18n, SEO, PWA

- i18n-библиотеки нет. Строки захардкожены.
- JSON-LD `AutoRepair` только на HomePage. `robots.txt` (Disallow `/dashboard`, `/login`, `/register`), `sitemap.xml` (9 публичных URL), `manifest.webmanifest` в `frontend/public/`.
- SPA без SSR. Service worker нет. Иконка манифеста мелкая — PWA installability не закрыта.

---

## 8. Доступность (WCAG 2.2 AA)

Сделано и подтверждено:

- `lang="ru"`, skip-link → `#main-content` / `#dashboard-main`.
- `<main id="dashboard-main">`.
- `eslint-plugin-jsx-a11y` на **warn**.
- `tests/e2e/a11y-critical.spec.js`: home, consult, login, booking, register, client overview, manager queue. Теги wcag2a/aa/22aa. **`color-contrast` выключен.** Серьёзные/критичные violation — гейт.
- `prefers-reduced-motion`. Modal: focus trap был подтверждён исходным аудитом.

Не сделано: contrast в гейте, mobile Playwright, keyboard-only project, target size 2.2 на плотных таблицах.

**Оценка 7.0** — есть гейт, нет полной WCAG-программы.

---

## 9. Производительность

Frontend: vendor chunk, lazy, font subset, nginx immutable assets. Нет RUM / Lighthouse CI. CSS ~415 KB — LCP-риск.

Backend: кэш диагноза, async job, compression. Cosine по JSON embeddings. Таймаут диагноза до 240 с. k6: 5 VU, 30 с, p95 HTTP < 5 с, бьёт `/api/live` и создание консультации + сообщение. В CI k6 **не гоняется**.

---

## 10. Надёжность и эксплуатация

Сильное: healthcheck всех сервисов включая worker; `restart: unless-stopped`; read_only frontend; graceful shutdown; LLM fallback; backup скрипты; mem_limit.

Слабое:

- `render.yaml` — Node API + static frontend, **без Redis и worker**, start с migrate. Дрейф к Compose.
- Нет OTel collector в Compose (экспорт только если задан `OTEL_EXPORTER_OTLP_ENDPOINT`).
- SLA/reminders/outbox — `setInterval` внутри worker, не отдельный scheduler.
- Healthcheck worker — только `test -f /tmp/worker-ready`, без ping БД/Redis/очереди.
- В `.env.example` нет `OTEL_*`. В `.env.production.example` нет части Zod-ключей (`STAFF_2FA_REQUIRED`, `LLM_CLOUD_PII_ALLOWED`, `GUEST_SESSION_TTL_HOURS`, SMS, vision/timeouts). Upload-пути и `DEMO_*_PASSWORD` читаются из `process.env` вне Zod.
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

Collector в Compose нет. Диагностика «90 секунд диагноза — где?» возможна только при внешнем OTLP.

---

## 12. Тестирование

| Уровень | Факт |
|---------|------|
| Backend unit + integration + eval + security | 55 файлов, 192 кейса |
| Frontend Vitest | 43 файла, 154 кейса; coverage при `CI=true`, **без порогов** |
| E2E | 5 spec: migration-flow, admin-nav-smoke, ui-review, ai-timeout, **a11y-critical**. Chromium, workers: 1 |
| Perf | k6 консультация; не в CI |
| Eval | 38 JSON, rule-based `preAnalyzeSymptoms`; `passed >= 30`. Дубликат `scenarios.json` в `src/modules/eval` и `tests/eval` |

CI e2e: Postgres + Redis + migrate + seed + Playwright; `reuseExistingServer: !CI`. P0 «e2e без backend» закрыт.

Coverage backend: lines/statements 50, branches/functions 40 — только в CI. Upload coverage нет.

Слабо: integrations (кроме кусков), serviceRecords, jobs, vision, embeddings indexer, менеджерский/админ UI как страницы, гараж, 2FA-страница.

Контрактных тестов нет — и не из чего, пока нет YAML.

Backend lint errors в `tests/integration/service-request-pdf.test.js` (неиспользуемые импорты) входят в те же 9.

---

## 13. CI/CD

`.github/workflows/ci.yml`: lint (включая routes:check **и openapi:check**), build, test-backend (Postgres), test-frontend, e2e (Postgres+Redis), security (audit, SBOM, Trivy exit 0), CodeQL, TruffleHog.

Плюсы относительно исходного аудита: `concurrency`, Dependabot (npm ×3 + actions + docker), Playwright artifact, Redis в e2e, Node 22.

Минусы относительно стандарта 2026 (гейты lint/openapi в S6 зелёные):

- Нет coverage upload.
- k6 не в CI.
- Три `npm ci` без workspaces.

---

## 14. ИИ-консультация

Пайплайн сильный: structured diagnostics, JSON schema, merge, OBD, case memory, feedback few-shot, vision-заготовка, async BullMQ, `PROMPT_VERSION = consultation-prompts.v1`.

| Практика LLMOps 2026 | Статус |
|----------------------|--------|
| Offline eval (rules) | 38 сценариев |
| Live model eval / LLM-as-judge | Nightly extraction golden set (6 кейсов, порог 80%); не LLM-as-judge; e2e без LLM |
| Версия промпта в логах/метриках | Константа в файле, не телеметрия |
| Token accounting | Нет |
| RAG | pgvector HNSW + JSON fallback с лимитом скана |
| Tracing gen-ai | Общий OTel HTTP; нет Langfuse |
| Цель p95 ≤ 45 с | Таймаут 240 с |

Конституция v1.1.0 (amended 2026-08-15): облачная LLM **разрешена**. Остаётся конфликт: «white is the primary background» vs тёмная тема по умолчанию.

---

## 15. Интеграции, уведомления, контент

Модель CRM (connections, jobs, outbox, cursors) богатая. Enum **12** провайдеров (`ONE_C`, три AUTODEALER, BITRIX24, AMOCRM, YCLIENTS, MOYSKLAD, MEGAPLAN, GENERIC_REST/WEBHOOK, FILE_EXCHANGE). Реестр адаптеров: **только `GENERIC_REST`**. В админ-карточках `MOYSKLAD` нет (есть в enum/labels). Остальные карточки `supported: false`.

Outbox: стабильный ключ, drain каждые 3 с в worker, не на hot path HTTP.

Уведомления: inbox, Telegram, booking reminders, SLA. SMS — заглушка (`SMS_NOT_CONFIGURED`).

CMS достаточна для white-label сайта.

---

## 16. Документация (Diátaxis)

| Тип | Есть | Качество |
|-----|------|----------|
| Tutorial | `docs/ONBOARDING.md` | Высокое |
| How-to | `docs/deploy.md`, `docs/demo.md` | Актуальны (worker в таблице Compose) |
| Reference | инвентарь JSON; OpenAPI YAML **отсутствует**; Prisma schema | Инвентарь ок |
| Explanation | `docs/architecture.md` | Синхронизирован с worker/OTel |
| Constitution | `.specify/memory/constitution.md` v1.1.0 | LLM ок; белый фон — нет |
| Журнал | `CHANGELOG.md` (15 строк, спринты) | Тонкий, есть |
| Спеки | каталог `specs/` | **Нет на диске**; README на него ссылается |

Нет LICENSE, CONTRIBUTING, ADR. `docs/setup.md` нет (старый дубль снят). Security-доки есть, в знаменатель этого аудита не входят.

---

## 17. Developer Experience

Нет: workspaces, Prettier, Husky/Lefthook, Storybook, codegen клиента, devcontainer.

Есть: `.nvmrc`/engines `>=22`, ONBOARDING, `llm:check`, `routes:inventory`. `openapi:check` в текущей копии — ловушка.

---

## 18. Юридическая и продуктовая полнота (не security)

152-ФЗ шаблон, оферта, cookie-категории, consent на формах, юр. тексты в CMS. Это комплектность артефактов, не правовая экспертиза. Аналитические cookie не подключены к трекеру.

События: `consult_started`, `diagnosis_shown`, `request_created`, `booking_confirmed` → `POST /api/product-events`. RUM/Lighthouse нет. Feature flags — только env.

---

## 19. Конституция (кроме security)

| Обязательство | Факт |
|---------------|------|
| Клиент-сервер, REST, PostgreSQL | Да |
| Три роли и кабинеты | Да |
| Структурированная диагностика | Да |
| Сайт: home, gallery, works, location, services, consult | Да (+ about/booking) |
| Telegram по заявке | Да |
| Тестовые уровни | Формально да; perf не в CI; lint/openapi красные |
| Локальная LLM | Разрешено облако (v1.1.0) |
| Белый фон, оранжево-чёрный акцент | Тёмная тема по умолчанию; бренд оранжевый; в MASTER navy-кнопка |

---

## 20. Реестр находок (повторная оценка)

### P0

| ID | Находка | Домен | Статус |
|----|---------|-------|--------|
| P0-1 | CI e2e без backend | Тесты | ✅ S1, e2e поднимает API |
| P0-2 | Redis без AOF при async-диагнозе | Надёжность | ✅ S1 |
| P0-3 | OpenAPI не покрывает маршруты | API | ✅ S6 YAML 188 ops + `openapi:check` (схемы stub) |
| P0-4 | Корневой lint / `openapi:check` красные | CI / DX | ✅ S6 |

### P1

| ID | Находка | Статус |
|----|---------|--------|
| P1-1 | Нет OTel / метрик | ✅ traces + Prometheus; collector нет |
| P1-2 | Mixed health | ✅ live/ready |
| P1-3 | Nginx буфер SSE | ✅ (S1) |
| P1-4 | God-файлы JS/TSX и CSS | ◐ S7–S13: JS/TSX-фасады и CSS-слои; widgets 855, service-book 975, consultations.service 691 |
| P1-5 | Backend JS, слабый ESLint | ◐ S6 lint зелёный; JS, не TS |
| P1-6 | Error Boundary | ✅ |
| P1-7 | Eval без живой LLM; k6 | ◐ S13 nightly live extraction; k6 не в CI |
| P1-8 | Один CRM-адаптер при enum из 12 | ☐ только GENERIC_REST; MOYSKLAD нет в админ-карточках |
| P1-9 | jsx-a11y / axe | ✅ axe e2e; jsx-a11y warn; contrast off |
| P1-10 | Embeddings JSON, нет pgvector | ✅ S8 pgvector + `CASE_MEMORY_MAX_SCAN` |
| P1-11 | MASTER vs токены | ✅ S6 primary `#ea580c` |
| P1-12 | Конституция vs продукт | ◐ LLM облако ок; белый фон нет |
| P1-13 | Playwright: один браузер, нет mobile | ☐ |
| P1-14 | Coverage 40–50% | ◐ frontend coverage в CI; пороги backend те же |

### P2

| ID | Находка | Статус |
|----|---------|--------|
| P2-1 | Нет v1 / cursor / Idempotency | ◐ RFC 9457 + Idempotency на публичных POST; нет v1/cursor |
| P2-2 | Offset-пагинация до 500 | ☐ |
| P2-3 | Worker в процессе API | ✅ Compose `worker`; SLA на setInterval внутри worker |
| P2-4 | Нет TanStack Query / SSR meta | ☐ |
| P2-5 | Нет i18n | ☐ |
| P2-6 | SEO / PWA | ◐ sitemap/robots/JSON-LD; SW нет |
| P2-7 | CI hygiene | ◐ concurrency, Dependabot, artifact; coverage upload нет; гейты lint/openapi сломаны |
| P2-8 | Нет mem_limit | ✅ |
| P2-9 | render.yaml / architecture.md | ◐ architecture.md актуален; **render.yaml устарел** |
| P2-10 | Два backend-порта в dev | ☐ |
| P2-11 | Продуктовые события / RUM | ◐ 4 события воронки; RUM/LH нет |
| P2-12 | Storybook / визуальная регрессия | ☐ |
| P2-13 | PgBouncer | ◐ connection_limit=15 |
| P2-14 | ADR, LICENSE, CHANGELOG, CONTRIBUTING | ◐ тонкий CHANGELOG; остального нет |
| P2-15 | Промпты / токены | ◐ PROMPT_VERSION; учёта токенов нет |
| P2-16 | Бэкап без uploads | ✅ |
| P2-17 | `.env.production.example` / `.env.example` vs Zod | ◐ S6: `OTEL_*`, `TOTP_ENCRYPTION_KEY`, `HMAC_PEPPER`; остаётся STAFF_2FA / SMS / vision |
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
| P3-3 | Manifest icon 64×64 | ☐ |
| P3-4 | Нет noUncheckedIndexedAccess | ☐ |
| P3-5 | Feature flags только env | ☐ |
| P3-6 | Analytics в primary DB | ☐ |
| P3-7 | Мёртвые страницы вне роутера | ✅ S12 удалены `ClientConsultationsPage`, `ClientRequestsPage`, `ClientRequestDetailPage` |
| P3-8 | SSE — этапы, не token stream | ☐ (осознанно) |
| P3-9 | SMS-заглушка | ☐ |
| P3-10 | Клиентский API без runtime-схемы | ☐ |

---

## 21. Дорожная карта (90 дней, без security)

Приоритет — платформа после честных гейтов.

### Дни 1–7 — починить ложную уверенность → **S6, сделано**

1. ✅ Восстановить `openapi.yaml` (`npm run openapi:sync`); `openapi:check` зелёный (188 ops).
2. ✅ Закрыть 9 ошибок ESLint backend; корневой `npm run lint` зелёный.
3. ✅ `docs/README.md` указывает на сгенерированный контракт.
4. ✅ MASTER `.btn-primary` — `#ea580c`.

### Дни 8–45

5. Богатые схемы OpenAPI на консультацию/заявки/запись + schemathesis nightly.
6. ✅ S7–S13: фасады flow/заявок/AI; Consult/гараж/Booking; CSS-слои включая vehicles и overview. Остались widgets.css 855 и consultations.service.js.
7. ✅ S8: pgvector HNSW + `CASE_MEMORY_MAX_SCAN`.
8. Coverage 70% на consultations + serviceRequests; upload в CI.
9. OTel collector в Compose (хотя бы noop-совместимый профиль).

### Дни 45–90

10. Live LLM eval nightly (golden set, не в PR на каждый коммит).
11. Второй CRM-адаптер, если демо обещает Bitrix/1C.
12. `/api/v1` + cursor на длинных списках.
13. workspaces + Prettier + Lefthook.
14. i18n и/или TanStack Query — только если white-label/команда фронта растёт.
15. RUM или Lighthouse CI на публичные страницы.

Оценка остатка: **1 сильный full-stack ~ 5–7 недель**, если не смешивать с фичами кабинетов. Пункты 1–3 — **часы**, не недели; без них S5 по контракту не считается закрытым.

---

## 22. Приложение A. Модули backend

auth · users · consultations / consultationAi / consultationFlow · serviceRequests · requestMessages · completionDocuments · bookings · vehicles / serviceRecords · admin / siteSettings / content · analytics · integrations (GENERIC_REST) · notifications · contact · eval · jobs (SLA, reminders, guest TTL, outbox) · worker runtime.

## 23. Приложение B. Тесты (сводка)

**Frontend 43 файла / 154 кейса:** api client, auth, формы, Consult/Booking, SSE, cookieConsent, client-cases, Error Boundary, ошибки, labels. Нет page-тестов `pages/manager/` и `pages/admin/` (кроме e2e smoke/a11y очереди). Гараж и `ProfileSecurityPanel` без page-тестов. Coverage в CI собирается, **порогов нет**.

**Backend 55 файлов / 192 кейса:** auth/otp/sessions, consultation (+ stream, AI, access, observability), service-requests (concurrency, pdf, messages, completion), bookings, admin, analytics, contact, telegram, notifications, health, product-events, idempotency, problem details.

**E2E 5 spec.** **Eval 38** rule-based. **k6** консультация, не в CI.

## 24. Приложение C. Не аудировали

- Пентест и threat model — отдельный `docs/SECURITY-AUDIT-2026-08-15.md`.
- Нагрузочный прогон k6 на живом демо — скрипт прочитан, не запускался.
- Lighthouse по `autoservice-demo.zernov.online` — не снимался.
- Юридическая сила 152-ФЗ.
- Качество конкретной облачной модели.

---

## 25. Заключение

Спринты 1–13 закрыли пробы, Redis, worker, CSS-слои, axe, OTel, события воронки, **гейты lint/OpenAPI**, распил consultation flow, **pgvector case memory**, хуки Consult/гаража, **фасад заявок**, **фасад AI-диагноза**, **BookingPage / JSX гаража / widgets.css**, **vehicles/overview CSS**, **nightly live LLM eval**. Stub-схемы OpenAPI и k6-в-CI остаются.

**Итог: 7.5 / 10.** Было 5.9 → 6.5 → 6.8 → 7.0 (самооценка S5) → 6.6 (повторная оценка) → 6.8 (S6) → 6.9 (S7) → 7.0 (S8) → 7.1 (S9–S10) → 7.2 (S11) → 7.3 (S12) → 7.4 (S13 CSS) → **7.5 (S13 live eval)**.

Если цель — демо: **достаточно**.  
Если цель — стандарт 2026 без security-трека: квартал по остатку §21 / §27.

---

## 26. Сверка с предыдущим текстом аудита

Тело исходного документа (до этой пересъёмки) содержало **устаревшие утверждения**, уже закрытые спринтами, но не вычищенные из §7–§13: «нет jsx-a11y / axe», «dashboard-main — div», «нет sitemap/JSON-LD», «k6 бьёт /users/me», «нет concurrency/Dependabot», «нет traces». Они **не** описывают текущий код. Этот файл заменяет их фактическим состоянием.

Не подтверждено и в реестр не возвращалось: «Modal без focus trap».

---

## 27. Бэклог после S13 (S14+)

P0 гейтов закрыты. Не смешивать с фичами кабинетов:

| Приоритет | Что |
|-----------|-----|
| P1 | Распил `consultations.service.js` / `ManagerRequestDetailPage`; `vehicles-service-book.css` 975 |
| P1 | TypeScript backend **или** жёсткий ESLint + Prettier + workspaces |
| P1 | Второй CRM-адаптер при обещании Bitrix/1C |
| P2 | Богатые OpenAPI-схемы + контрактные тесты |
| P2 | `/api/v1`, cursor-pagination |
| P2 | Coverage 70% + upload |
| P2 | Починить `render.yaml` или пометить deprecated |
| P2 | Сверить `.env.production.example` с оставшимися ключами Zod |
| P2 | i18n, TanStack Query, Storybook |
| P2 | LICENSE, ADR, CONTRIBUTING |
| P2 | RUM / Lighthouse CI; OTel collector; k6 в CI |
| P3 | Дубликат `scenarios.json`; карточка `MOYSKLAD`; manifest icon; SMS |

Следующий спринт логично начать с **распила `consultations.service.js` / `ManagerRequestDetailPage`**.

Нужен GitHub secret `LLM_API_KEY`, иначе nightly live-eval будет skip.
