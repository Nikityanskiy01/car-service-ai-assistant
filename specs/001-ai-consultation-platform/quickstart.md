# Quickstart: Express API + static HTML frontend

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)  
**Date**: 2026-03-24 (обновлено 2026-04-06)

Актуальная пошаговая инструкция: [../../docs/setup.md](../../docs/setup.md).

## Prerequisites

- Node.js **22 LTS** (см. корневой `.nvmrc`)
- PostgreSQL **16+** (удобно через `docker compose` в корне репозитория)
- **Ollama** — нативный API `/api/chat` (не OpenAI-compatible proxy)
- Токен Telegram-бота (опционально для уведомлений)

## Backend

```bash
cd backend
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Либо только миграции: `npx prisma migrate deploy` и `npm run db:seed`.

Пример переменных `backend/.env` (подробнее — [../../docs/env-variables.md](../../docs/env-variables.md)):

- `DATABASE_URL` — PostgreSQL
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS`
- `LLM_BASE_URL`, `LLM_MODEL`, `LLM_ENABLED`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MANAGER_CHAT_IDS`
- `PORT` (например 3000)
- `CORS_ORIGIN` — обязателен в **production**; в development можно не задавать (разрешены любые origin для удобства LAN)

## Frontend

**Вариант A (основной):** Express раздаёт `frontend/` — открыть `http://127.0.0.1:3000/`.

**Вариант B:** отдельный static host — настроить `credentials: 'include'` и тот же origin/прокси, что и API, чтобы работали httpOnly JWT и CSRF-cookie.

Аутентификация: access/refresh в **httpOnly-cookie**, для мутаций с сессией нужен заголовок `X-CSRF-Token` (см. [../../docs/api.md](../../docs/api.md)).

## Проверка API

Контракт: [contracts/openapi.yaml](./contracts/openapi.yaml) — может отставать от кода; сверка с [../../docs/api.md](../../docs/api.md).

## Тесты

```bash
cd backend
npm test
```

E2E (из корня репозитория):

```bash
npm install
npx playwright install
npm run test:e2e
```

CI: см. [../../docs/testing.md](../../docs/testing.md) и `.github/workflows/ci.yml`.
