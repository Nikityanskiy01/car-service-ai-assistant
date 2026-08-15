# Changelog

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
