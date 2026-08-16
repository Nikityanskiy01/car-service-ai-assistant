# Changelog

## 2026-08-16 — аудит: пересъёмка после S30

- Независимая съёмка диска: паспорт, карта зрелости, реестр P0–P3. Итог **8.0 / 10** (S30 заявлял 9.4). Канвас и HTML-экспорт обновлены.

## 2026-08-16 — лимит больше не душит сайт

- Общий лимит не действует на GET: каталог, услуги и кабинет не показывают «подождите 2 мин».
- Счётчики лимитеров разведены по ключам Redis — вход больше не блокирует чтение страниц.
- Публичный каталог при сбое API показывает запасные услуги, без красной полосы.


## 2026-08-16 — шапка: ровнее кнопки справа

- Запись, диагностика и вход собраны в одну группу; язык и тема отделены чертой.
- RU/EN — один сегмент, одинаковая высота с темой. У оранжевой кнопки меньше свечения.

## 2026-08-16 — вход: короче бан, сессия не рвётся

- Лимит пароля: 20 попыток за 2 минуты вместо 10 за 15. Блокировка аккаунта после 5 ошибок — 2 минуты, не 15.
- Обновление сессии больше не сидит на лимитере входа: после неудачных попыток кабинет не выбрасывает.
- Access-токен 8 часов (смена), refresh по-прежнему 7 дней. Две вкладки больше не убивают сессию при одновременном refresh.
- Сбой сети или 429 не сбрасывает вход; выход только при 401/403.


## 2026-08-16 — без ответа: порог 15 минут

- Заявка считается без ответа, если клиент ждёт первый ответ дольше 15 минут. На столе, в очереди и в Telegram — те же минуты, не 4 часа.

## 2026-08-16 — S30

- Закрыт бэклог платформы: адаптеры Bitrix24 / МойСклад / 1С / webhook, SMS (smsru/http/log), `/api/v1` alias, cursor на записи и staff-консультации, схемы OpenAPI, coverage artifacts, k6 и Lighthouse в CI, Playwright mobile, OTel collector (profile `observability`), RUM web-vitals, i18n шапки, TanStack Query на интеграциях, Prettier/Lefthook, LICENSE/ADR/CONTRIBUTING, deprecated `render.yaml`, иконки PWA 192/512.

## 2026-08-16 — SLA: «Без ответа больше 4 ч»

- На столе, в очереди и в фильтрах больше нет аббревиатуры SLA. Смысл тот же: клиент ждёт ответ дольше 4 часов.

## 2026-08-16 — рабочий стол: больше метрик, проще скан

- Сигналы смены разделены: сверху только то, что требует действия, ниже снимок смены и неделя.
- Красный оставлен для SLA (и сбоя CRM). Новые и сайт — акцент, оценка ИИ — предупреждение, нули без окраски.

## 2026-08-16 — hotfix: админ больше не открывает URL менеджера

- `/dashboard/manager/*` для администратора сразу переписывается в пульт (`/dashboard/admin/...`). Очередь, записи, клиенты, обращения и качество ИИ остаются в админской зоне.
- После входа `next` с менеджерским путём тоже ведёт в админку, а не в кабинет менеджера.

## 2026-08-16 — hotfix: сломанные стили кабинета менеджера и админа

- Tailwind без preflight оставлял системные кнопки и маркеры списков. Сброс только внутри `[data-console]` (менеджер и админ), публичный сайт не трогаем.
- Вернул `bg-background` / `border-border` через `@theme inline` на `--console-*`, без цикла токенов.
- Календарь: сетка на кнопке записи, а не на `li` — бейджи больше не наезжают на имя и авто.

## 2026-08-16 — hotfix: стили календаря и очереди менеджера

- Календарь, фильтры очереди и массовые действия снова на классах `booking-day`, `calendar-stat-row`, `queue-filters`, `bulk-action-bar`. После shadcn страница не вызывала CSS, кнопки оставались с системной обводкой.

## 2026-08-16 — hotfix: 2FA лимит 1 минута

- После лишних попыток кода из приложения ожидание сокращено с 15 минут до 1 минуты. Лимит входа по паролю не менялся.

## 2026-08-16 — hotfix: стили рабочего стола менеджера

- Вернул классы `workdesk-*`, `priority-queue-*` и `dashboard-sidebar-link` на разметку. CSS никуда не делся — после shadcn страница его просто не вызывала, поэтому кабинет выглядел как каркас.

## 2026-08-16 — hotfix: 502 после пересборки backend

- Nginx больше не кэширует IP `backend` на старте: Docker DNS `127.0.0.11`, иначе после recreate API даёт 502 «Сервис временно недоступен».

## 2026-08-16 — hotfix: отвал публичных стилей

- Вернул недостающие токены поверхностей (стекло шапки, scrim, панели, чипы, кнопки outline). Без них `background`/`border` на публичных страницах становились невалидными.
- Разорвал цикл `--color-background` ↔ `--console-background` в `console.css`: Tailwind больше не перезаписывает фоновые/бордерные токены и радиусы.

## 2026-08-16 — S29

- Backend `src/` (176 файлов) переведён на TypeScript. Runtime — `tsx` (NodeNext, импорты с `.js`). `tsc --noEmit` входит в `npm run lint`. Тесты и prisma seed остаются JS. Вид API не менялся.

## 2026-08-16 — S28

- Публичный `booking.css` (836) разложен на wizard и breakpoints/legal/FAQ. `works.css` (741) — на page/grid, modal и breakpoints. `@import` сразу в `site.css`. Вид не менялся.
- Правило `.cursor/rules/css-layers-no-god-files.mdc`: не предлагать уже сделанный распил, не оставлять слои без barrel-импорта, не оставлять CSS >700 строк.

## 2026-08-16 — S27

- Публичный `home.css` (1012) разложен на hero/chat, stats/cards/map и auth. `gallery.css` (917) — на page/hero/filters, bento-grid и lightbox. Порядок каскада в `site.css` сохранён. Вид не менялся.

## 2026-08-16 — hotfix: 2FA «Сессия устарела»

- CSRF больше не блокирует `/auth/login/2fa` и OTP-вход, если в браузере остались cookie прошлой сессии. Текст «Сессия устарела» был ответом CSRF, а не истекшим кодом из приложения.
- При запросе 2FA старые auth-cookie сбрасываются. Код из поля подтверждения отправляется сразу, без ожидания следующего рендера.

## 2026-08-16 — S26

- `dashboard-consultation.css` (709) разложен на page/stages, chat bubbles и composer. `dashboard-alerts.css` (693) — на banners/queue, booking/contacts/funnel и completion/similar. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S25

- Публичный `inner-pages.css` (1414) разложен на about/page-head, services hero/toolbar, services grid/cards и chrome-overrides в `.fm-shell`. Порядок каскада в `site.css` сохранён. Вид не менялся.

## 2026-08-16 — S24

- `base.css` (1429) разложен на reset/chrome, landing/hero и cards/forms. `admin.css` (887) — на overview/inbox, scenarios/analytics и booking/palette. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S23

- `manager-console.css` (1097) разложен на desk/toasts/skeletons, queue (фильтры/таблица/канбан) и calendar/inbox/clients/pages. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S22

- `booking-app.css` (1154) разложен на wizard, detail, breakpoints и client polish (bottom-nav/onboarding). Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S21

- `dashboard-shell.css` (1189) разложен на layout/sidebar/menu, notifications и page/desk. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S20

- `consultationFlow/extract.js` стал фасадом (~14 строк); логика в `extract/{hints,regex,rules,policy,llm}`. Публичный API модуля не менялся.

## 2026-08-16 — S19

- `client-cases.css` (1619) разложен на card/progress, bookings, detail, overview и visit/messages. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S18

- `profile.css` (1861) разложен на hero/settings, security/2FA, sessions, password и shared responsive. Порядок каскада в `main.css` сохранён. Вид не менялся.

## 2026-08-16 — S17

- `useConsultPage` стал оркестратором (~106 строк); логика в `consultPage/{useConsultSession,useConsultChat,useConsultRequest,useConsultError}`. Публичный API хука не менялся.
- `ConsultPage` — оркестратор (~23); JSX в Chrome / Workspace / ContactModal. Вид не менялся.

## 2026-08-16 — S16

- `vehicles-service-book.css` (975) разложен на identity/oil, history/records и responsive/alerts. Вид не менялся.
- Остаток `dashboard-widgets.css` (855) разложен на welcome/metrics, lists/nav и board/kanban. Порядок каскада в `main.css` сохранён.

## 2026-08-16 — S15

- `integrations.service.js` стал фасадом (~19 строк); логика в `service/{helpers,connections,outbox,jobs,conflicts,webhooks,requests}`. Публичный API модуля не менялся.
- `dashboard.ts` (724) разложен на `api/dashboard/{requests,bookings,contacts,admin,profile,security,followup,analytics}`; barrel реэкспортирует то же API.

## 2026-08-16 — S14

- `consultations.service.js` стал фасадом (~17 строк); логика в `service/{access,sessions,messages,persist,reports,photo}`. Публичный API модуля не менялся.
- `ManagerRequestDetailPage` — оркестратор (~35); состояние в `useManagerRequestDetail`, JSX в Chrome/Panels/ExportModal. Вид не менялся.
- Nightly live LLM eval: extraction + diagnosis (10 golden-кейсов), порог 80%. Без `LLM_API_KEY` job падает, а не skip. Job summary + artifact отчёта.

## 2026-08-16 — hotfix: вход 429

- Сброшен Redis-лимит входа (`rl:*`). Все попытки с хоста шли в один ключ `172.18.0.1` (Docker gateway) и упирались в 10/15 мин.
- Лимит логина теперь по IP+идентификатору, успешный вход не считается, тексты 429 на русском, в UI есть «подождите N мин».

## 2026-08-16 — S13

- `vehicles.css` (2119) разложен на `vehicles-garage`, `vehicles-photo`, `vehicles-service-book`, `vehicles-records`. Вид не менялся.
- `client-overview.css` (2103) разложен на overview / garage-rail / focus / cases-page / manager-polish. Вид не менялся.
- Nightly live LLM eval: 6 golden-кейсов extraction, порог 80%, workflow `.github/workflows/llm-eval-nightly.yml` (secret `LLM_API_KEY`).

## 2026-08-16 — S12

- `BookingPage` — оркестратор (~226); логика в `features/booking`. JSX гаража — секции. `dashboard-widgets.css` слои (consultation/followup/diagnosis/chrome/responsive).

## 2026-08-16 — S11

- `consultationAi.service.js` стал фасадом (~21 строка); логика в `consultationAi/{coerce,quality,preAnalyze,merge,generate}`. Публичный API модуля не менялся.

## 2026-08-16 — S10

- `serviceRequests.service.js` стал фасадом (~19 строк); логика в `service/{create,list,read,mutate,dossiers,ops,helpers}`. Публичный API модуля не менялся.

## 2026-08-16 — S9

- Логика `ConsultPage` вынесена в `useConsultPage` (~452 строки); страница ~299 строк JSX.
- Гараж: метки/хелперы в `vehicleDetailLabels.ts`, состояние в `useClientVehicleDetail`; страница ~668 строк JSX.

## 2026-08-16 — S8

- Case memory: pgvector HNSW (`embedding_vec`) + лимит JSON-скана `CASE_MEMORY_MAX_SCAN`.
- Образ БД: `docker/postgres` (тот же Alpine 16 + pgvector 0.8.1), CI — `pgvector/pgvector:0.8.6-pg16`.

## 2026-08-15 — S7

- `consultationFlowService.js` стал фасадом (240 строк); логика в `consultationFlow/{state,questions,extract,progress}`. Публичный API модуля не менялся.
- Тексты ошибок и стадии консультации вынесены из `ConsultPage` в `consultPageCopy.ts`.

## 2026-08-15 — S6

- Восстановлен OpenAPI 0.5.0 (188 ops); `openapi:check` зелёный; генератор создаёт каталог `specs/`.
- Backend ESLint: 9 errors закрыты; корневой `npm run lint` зелёный.
- `docs/README` указывает на контракт; MASTER `.btn-primary` `#ea580c`; `OTEL_*` в `.env.example`.
- Production-секреты `TOTP_ENCRYPTION_KEY` и `HMAC_PEPPER` в примерах env; без них API не стартует при `NODE_ENV=production`.
- Redis с `cap_drop: ALL` запускается от `999:1000`, иначе AOF 0700 недоступен без `DAC_OVERRIDE`.

## 2026-08-15 — S5

- OpenAPI 0.5.0 покрывает все 188 path+method из инвентаря; в CI — `npm run openapi:check`.
- CSS публичного сайта и кабинетов разложен по слоям (`frontend/src/styles/app/*`, `styles/site/*`); вид не менялся.
- Фоновые jobs вынесены в Compose-сервис `worker` (`node src/worker.js`); API с `RUN_BACKGROUND_JOBS=false`.

## 2026-08-15 — S4

- OpenTelemetry traces, axe e2e на ключевых страницах, Idempotency-Key на публичных POST, outbox poller.

## 2026-08-15 — безопасность 1–4

- OTP/backup/guest HMAC, LLM-квоты и PoW, Redis AUTH, staff 2FA, EXIF-sanitize, pin образов по digest, CodeQL и TruffleHog.
