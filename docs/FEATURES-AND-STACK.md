# Каталог фич и технологий

Снимок продукта на **16 августа 2026**. Это полный перечень того, что **уже есть в коде и стеке**, по категориям.

Рядом лежат более узкие документы — они не дублируют этот каталог целиком:

| Документ | Что там, чего нет здесь |
|----------|-------------------------|
| [product.md](./product.md) | Роли и URL экранов |
| [architecture.md](./architecture.md) | Поток консультации, модули API |
| [testing.md](./testing.md) | Как гонять тесты |
| [deploy.md](./deploy.md) | Compose, Nginx, бэкапы |
| [FULL-AUDIT-2026-08-15.md](./FULL-AUDIT-2026-08-15.md) | Оценка зрелости и долг |

Демо: [autoservice-demo.zernov.online](https://autoservice-demo.zernov.online).

---

## 1. Что это за продукт

Веб-приложение автосервиса: публичный сайт, ИИ-диагностика в чате, заявки, запись на визит, гараж и сервисная книжка, три кабинета (клиент / менеджер / администратор), CMS и white-label, интеграции CRM/1С, уведомления.

Форма: **modular monolith**, SPA + REST, один Docker Compose.

Роли RBAC: `CLIENT`, `MANAGER`, `ADMINISTRATOR`. Гость без аккаунта может пройти консультацию и оставить заявку/запись; после входа сессия **claim**-ится на профиль.

---

## 2. Публичный сайт

| Экран | Что умеет |
|-------|-----------|
| Главная `/` | Hero, услуги, вход в диагностику, JSON-LD `AutoRepair` |
| Услуги `/services` | Каталог услуг из CMS |
| Примеры работ `/works` | Кейсы работ |
| Галерея `/gallery` | Фото из CMS |
| О сервисе `/about` | Контакты, карта, реквизиты |
| ИИ-консультация `/consult` | Чат-диагностика (гость и клиент) |
| Запись `/booking` | Публичная запись на визит |
| `/privacy`, `/terms` | Юридические страницы из CMS |
| Вход / регистрация | Пароль, OTP (email или Telegram), 2FA |
| Почта | Подтверждение email, забыли пароль, сброс |

Контент и оформление (название, цвета, реквизиты) задаются в админке и отдаются `GET /api/content/site-settings`.

Ещё на публичке: cookie-баннер (согласие), skip-link, `<main>`, sitemap.xml, robots.txt, PWA-манифест и иконки 192/512, `security.txt`. Service worker **нет** — это не устанавливаемое PWA.

Шапка: i18n **ru/en** (~22 ключа). Кабинеты — только русский.

---

## 3. Кабинет клиента

Принцип: на экране понятно, **что делать дальше**. На мобилке нижняя навигация: Обзор / Обращения / Записи / Ещё.

| Раздел | Фичи |
|--------|------|
| Обзор | Сводка обращений и записей, следующий шаг |
| Мои обращения | Список + карточка Case: консультация + заявка + переписка + запись |
| Записи | Список и карточка визита, перенос/отмена |
| Гараж | Авто, фото, сервисная книжка, план замены масла (7500 км / 6 мес.) |
| Профиль | Данные, пароль, 2FA, сессии, согласия, каналы уведомлений |
| ИИ-диагностика | Тот же `/consult`, история в обращениях |

**Обращение (Case)** склеивает консультацию, заявку, переписку и запись в одну карточку.

Статусы заявки: Новая → В работе → Запись назначена → Завершена / Закрыта.

Статусы записи: Ожидает → Подтверждена → Приехал / Не приехал / Отменена.

---

## 4. Кабинет менеджера

Операционный приёмщик: очередь после ИИ → визит → ответ клиенту → оценка диагноза.

| Раздел | Фичи |
|--------|------|
| Рабочий стол | Очередь, SLA «без ответа» (15 мин), быстрые действия |
| Очередь | Список и канбан; на широком экране таблица |
| Карточка заявки | Вкладки: сводка / диалог консультации / переписка / работы и оценка / история·CRM. Экспорт PDF. Чек-лист «В сервис» |
| Календарь | День / неделя (7 равных колонок), легенда статусов, отметки приехал / не приехал |
| Клиенты | Лента клиентов, карточка справа, звонок и копирование телефона |
| Сообщения с сайта | Форма с лендинга: в работу, создать заявку или закрыть без заявки |
| Качество ИИ | Совпадение с сервисом, полезность, очередь оценок, симптомы и причины |
| Профиль | Как у клиента + рабочий контекст |

---

## 5. Кабинет администратора

Семь зон. Операционные экраны переиспользуют страницы менеджера (`adminZone`). `Ctrl+K` — переход по разделам.

| Зона | Фичи |
|------|------|
| Пульт | Status Strip (ИИ · CRM · очередь), Action Inbox, KPI |
| Аналитика | Воронка, KPI, качество ИИ |
| Операции | Заявки, записи, клиенты, сообщения с сайта |
| Команда | Пользователи (роли), активность, сессии |
| ИИ-студия | Статус моделей, сценарии вопросов, справочники, память кейсов, обратная связь |
| Сайт | Услуги и галерея, текстовые блоки, оформление (цвета), юр. данные |
| Интеграции | Подключения CRM, очередь джоб, конфликты |
| Безопасность | Журнал действий админа, список сессий |

---

## 6. ИИ-консультация (ядро продукта)

Гибрид: rule-based плейбуки + LLM. Если модель недоступна, сессия **не падает** — уходит разбор по плейбуку мастера.

### Поток

1. Создание сессии (клиент или гость с `guestToken`).
2. Чат: сбор марки, модели, года, пробега, симптомов, условий; опционально OBD и фото.
3. **Extraction** — лёгкая модель, JSON-поля.
4. При полноте — **diagnosis** (тяжёлая модель, JSON schema).
5. Похожие кейсы: pgvector HNSW (cosine) + лексический fallback.
6. Merge с rule-based; few-shot из оценок менеджера (если включено).
7. Опционально async через BullMQ (`DIAGNOSIS_ASYNC_ENABLED`, на демо обычно выкл.).
8. Оформление заявки и/или записи.

В чате диагноз приходит **в том же сообщении** (не «результат появится позже»), с причинами и проверками.

### Плейбуки мастера

`engine-misfire`, `engine-no-start`, `engine-check-engine`, `cooling-overheat`, `suspension-knock`, `brakes-vibration`, `at-shift`, `battery-drain`, `ac-weak`, `oil-leak`, `hub-bearing`, `planned-maintenance`.

### Надёжность ИИ

- Circuit breaker на LLM (порог отказов + cooldown).
- Кэш диагноза (TTL, ограничение записей).
- Отдельные модели: extraction / diagnosis / embeddings / vision (`llava` по умолчанию).
- Провайдеры: Ollama native **или** OpenAI-compatible (VseLLM и аналоги), опциональный fallback второго провайдера.
- `LLM_CLOUD_PII_ALLOWED` — облако без PII по умолчанию.
- Eval: 38 rule-based сценариев + nightly live golden set (extraction+diagnosis, порог 80%).
- Менеджер ставит вердикт: верно / частично / нет → метрики «Качество ИИ».

---

## 7. Заявки, запись, гараж, документы

- Заявки: статусы, optimistic concurrency, переписка с вложениями (фото, PDF), документы завершения работ, PDF заявки (кириллица DejaVu).
- SLA эскалация: нет первого ответа **15 минут** → уведомление.
- Запись: публичная и из кабинета, подтверждение/перенос/отмена, календарь менеджера, аудит изменений.
- Гостевая запись на email.
- Гараж: несколько авто, фото, исключения, сервисная книжка (работы, PDF одной записи и всей книжки), подсказка по маслу из книжки в консультации.
- PDF консультации.
- Форма с сайта → очередь «Сообщения с сайта» → заявка или закрытие.

---

## 8. Auth, сессии, безопасность продукта

Это продуктовые возможности, не отчёт пентеста.

- Регистрация, логин по телефону или email + пароль.
- OTP: email или Telegram.
- Access/refresh JWT в httpOnly cookie (`car_service_at` / `car_service_rt`), SameSite=Lax.
- CSRF double-submit (`car_service_csrf` + `X-CSRF-Token`).
- TOTP 2FA + резервные коды; для сотрудников на проде `STAFF_2FA_REQUIRED`.
- Политика пароля, bcrypt, сброс и верификация почты (SMTP / на демо Mailpit).
- Список сессий, отзыв, журнал входов.
- Rate limit на логин и публичные записи консультации (Redis, если задан).
- Helmet, CORS, compression.
- Согласия 152-ФЗ (`ConsentEvent`), cookie-banner.
- Идемпотентность публичных POST: заголовок `Idempotency-Key`.
- Ошибки API: RFC 9457 `application/problem+json` + совместимость `{ error, code }`.
- Alias `/api/v1/*` тех же маршрутов (не отдельная версия контракта).
- Журнал админ-действий, шифрование секретов интеграций и TOTP, HMAC pepper.

---

## 9. Уведомления

Каналы: **inbox в кабинете**, email (SMTP), Telegram, SMS (smsru / произвольный HTTP / log).

Виды: создана / подтверждена / отменена / перенесена запись, напоминание за день и за час, сообщение менеджера, маркетинг, документы завершения.

Настройки пользователя: темы (записи / сообщения / маркетинг) и каналы. Дедуп по `dedupe_key`.

Telegram: бот для OTP/привязки чата; алерты менеджеру о новой заявке (`TELEGRAM_MANAGER_CHAT_IDS`).

---

## 10. Интеграции CRM / учёт

12 провайдеров enum, все зарегистрированы:

| Провайдер | Адаптер |
|-----------|---------|
| AMOCRM | amoCRM v4 |
| YCLIENTS | partner API |
| MEGAPLAN | MegaPlan v3 |
| BITRIX24 | Bitrix24 |
| MOYSKLAD | МойСклад |
| ONE_C, GENERIC_REST, AUTODEALER_WEB, AUTODEALER_ONLINE | Generic REST |
| GENERIC_WEBHOOK | исходящий webhook |
| FILE_EXCHANGE, AUTODEALER_DESKTOP | file-drop |

Есть: подключения и статусы, маппинг статусов, jobs + retry/dead-letter, inbox конфликтов, outbox (poller на worker, не на HTTP), входящие вебхуки, курсоры синка, аудит, source-of-truth (локально / внешнее / last-write / ручное).

---

## 11. CMS и бренд

- Site settings: имя, цвета, контакты.
- Категории услуг, блоки текста с версиями, галерея/работы.
- Юридические реквизиты для privacy/terms.
- Токены лендинга: `design-system/autoservice-ai/`.
- Шрифты: **Manrope** + Source Sans 3; акцент navy/orange (`#ea580c` primary), не Inter и не фиолетовый SaaS-градиент.

---

## 12. Стек по слоям

### Frontend

| | |
|--|--|
| UI | React 19, React Router 7, TypeScript (strict на фронте) |
| Сборка | Vite 7, Tailwind CSS 4 (`@tailwindcss/vite`) |
| Компоненты | Radix UI (dialog, dropdown, select, tabs, tooltip, …), CVA, lucide-react |
| Данные | fetch-клиент свой; TanStack Query 5 — на странице интеграций |
| Тосты | Sonner + своя карточка поверх |
| Тесты UI | Vitest 3, Testing Library, jsdom |
| Истории | Storybook 9.1 (`@storybook/react-vite`), CSF кнопки |
| A11y | eslint-plugin-jsx-a11y (warn), axe-core в Playwright |
| i18n | свой `I18nProvider`, ru/en шапка |
| RUM | `rum_web_vital` → `/api/product-events` |

Стили: CSS-слои в `frontend/src/styles/` (barrel `main.css` / `site.css`), файлы не длиннее ~700 строк.

### Backend

| | |
|--|--|
| Рантайм | Node.js ≥22, Express 4, TypeScript через **tsx** (без отдельного compile step в образе) |
| Валидация | Zod (env и границы API) |
| ORM | Prisma 6 |
| Логи | Pino + pino-http, `trace_id` / `span_id` из OTel |
| Очередь | BullMQ 5 + ioredis |
| Почта | Nodemailer |
| PDF | PDFKit + DejaVu (кириллица) |
| Картинки | jpeg-js, pngjs (vision / обработка) |
| 2FA QR | qrcode |
| Telegram | Telegraf |
| Безопасность HTTP | helmet, cors, cookie-parser, express-rate-limit, rate-limit-redis |
| Сжатие | compression |

### Данные и очереди

| | |
|--|--|
| СУБД | PostgreSQL 16 Alpine + **pgvector 0.8.1** (образ `docker/postgres`) |
| Пул | `connection_limit=15` в URL Prisma; PgBouncer **нет** |
| Миграции | 41 |
| Кэш / очередь | Redis 7 Alpine, AOF `everysec`, пароль, volume |
| Worker | отдельный контейнер, тот же образ API, `src/worker.ts` |

Модели Prisma (ядро): User, сессии/OTP/reset/verify, Consent, prefs и inbox-уведомления, ClientVehicle + VehicleServiceRecord, ConsultationSession/Message/ExtractedDiagnosticData/DiagnosticRecommendation, embeddings, feedback, diagnosis jobs, ServiceRequest + follow-up + completion docs, ServiceBooking + audit, ContactSubmission, CMS, AdminAuditEvent, весь контур Integration*.

### ИИ-инфра

Ollama и/или OpenAI-compatible HTTP. Embeddings: `nomic-embed-text` (768) или `text-embedding-3-small` (1536). Vision-модель отдельно.

### Наблюдаемость

- `/api/live`, `/api/ready`, `/api/health` (БД+Redis)
- Prometheus `/api/metrics` (опционально `METRICS_TOKEN`)
- OpenTelemetry Node SDK, OTLP HTTP; collector — Compose profile `observability` (по умолчанию не поднят)
- Продуктовые события воронки: consult_started, diagnosis_shown, …

### Инфра и деплой

| | |
|--|--|
| Оркестрация | Docker Compose: `frontend`, `backend`, `worker`, `db`, `redis`, `mailpit` (profile `mail`), `otel-collector` (profile `observability`) |
| Фронт-образ | nginx-unprivileged 1.27, read_only, tmpfs |
| API-образ | node:22-alpine, migrate в CMD backend |
| Край | Nginx на хосте (`deploy/nginx/`), прокси на `:8080` |
| Письма на демо | Mailpit |
| Бэкапы | `deploy/ops/backup-postgres.sh` + systemd timer; uploads volume |
| Харденинг VPS | `deploy/security/vps-hardening.sh` |
| Лимиты | mem_limit 512m фронт / 1g API и worker; cap_drop ALL; no-new-privileges |
| Health | HTTP live у API, файл `/tmp/worker-ready` у worker |

### Качество и CI

| | |
|--|--|
| Lint | ESLint 9 + typescript-eslint, frontend + backend |
| Формат | Prettier, Lefthook |
| Backend тесты | Jest + Supertest (unit / integration / security / eval) |
| Frontend тесты | Vitest |
| E2E | Playwright (Chromium + Pixel 7 smoke), LLM выключен в PR |
| Нагрузка | k6 (`tests/perf/k6-consultation.js`) в CI job `perf` |
| Lighthouse | LHCI, warn |
| Контракт | `routes:check`, `openapi:check` (OpenAPI 0.5.0, 188 ops, 89 именованных схем) |
| Security jobs | npm audit (high), SBOM SPDX, Trivy fs CRITICAL, CodeQL, TruffleHog |
| Nightly | live LLM eval (fail-closed без `LLM_API_KEY`); Schemathesis `/live|/ready|/health` |
| Coverage | пороги Jest ~50/40, артефакты в CI |

---

## 13. Фоновые джобы (worker)

Отдельный процесс, API с `RUN_BACKGROUND_JOBS=false`.

- BullMQ: async-диагноз (если включён)
- Outbox drain интеграций (каждые 3 с)
- SLA-эскалация заявок (каждую минуту)
- Напоминания о записи (за сутки и за час)
- TTL гостевых сессий консультации (PII через `GUEST_SESSION_TTL_HOURS`, по умолчанию 24 ч)

---

## 14. API — карта доменов

Префикс `/api` (и alias `/api/v1`):

`/live` `/ready` `/health` `/metrics` `/product-events`  
`/auth` `/consultations` `/service-requests` (+ messages, PDF) `/bookings` `/users` `/vehicles` `/contact` `/content` `/admin` `/analytics` `/webhooks`

Cursor-пагинация: записи, staff-консультации и заявки (рядом с offset). Публичные POST принимают `Idempotency-Key`.

---

## 15. UI-кит (свои компоненты)

Button, Input, Textarea, Select, Card, Modal, Tabs, Alert, Toast, ConfirmDialog, DataTable, Pagination, Skeleton, Loader, EmptyState, ErrorState, StatusBadge, RoleBadge, UserAvatar, CopyPhoneButton, SiteImage, Reveal, IntegrationStatusBadge, PageSuspenseFallback, формы (FormField, PasswordInput, OtpCodeInput).

---

## 16. Чего в продукте нет (чтобы каталог был честным)

- Service worker / installability PWA
- PgBouncer
- npm workspaces
- Полный i18n кабинетов
- `noImplicitAny` / `strictNullChecks` на backend (флаги выключены). Точечно типизированы `auth` / OTP / `security` / `vehicles`.
- Chromatic / визуальная регрессия в CI
- SSR meta; QueryClient не на всех экранах кабинетов
- Отдельная analytics-БД, feature flags кроме env

---

## 17. Как читать дальше

- Экраны и URL — [product.md](./product.md)
- Поток консультации и модули — [architecture.md](./architecture.md)
- Запуск — [ONBOARDING.md](./ONBOARDING.md)
- Золотой путь демо — [demo.md](./demo.md)
- Журнал изменений — [CHANGELOG.md](../CHANGELOG.md)
