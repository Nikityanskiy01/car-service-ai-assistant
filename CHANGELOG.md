# Changelog

## 2026-08-15 — S5

- OpenAPI 0.5.0 покрывает все 188 path+method из инвентаря; в CI — `npm run openapi:check`.
- CSS публичного сайта и кабинетов разложен по слоям (`frontend/src/styles/app/*`, `styles/site/*`); вид не менялся.
- Фоновые jobs вынесены в Compose-сервис `worker` (`node src/worker.js`); API с `RUN_BACKGROUND_JOBS=false`.

## 2026-08-15 — S4

- OpenTelemetry traces, axe e2e на ключевых страницах, Idempotency-Key на публичных POST, outbox poller.

## 2026-08-15 — безопасность 1–4

- OTP/backup/guest HMAC, LLM-квоты и PoW, Redis AUTH, staff 2FA, EXIF-sanitize, pin образов по digest, CodeQL и TruffleHog.
