# AI Fox Motors

Веб-система первичной ИИ-консультации для автосервиса: **Express + Prisma + PostgreSQL** (backend), статический **HTML/CSS/vanilla JS** (frontend), локальный LLM (OpenAI-совместимый), уведомления в Telegram.

Спецификация и план: `specs/001-ai-consultation-platform/`.

## Требования

- Node.js 20+
- PostgreSQL 16+ (удобно через Docker: `docker compose up -d` в корне репозитория)
- Опционально: Ollama или другой OpenAI-compatible сервер для реального LLM

## Быстрый старт

1. Поднимите БД и при необходимости создайте БД для тестов:

   ```sql
   CREATE DATABASE foxmotors_test;
   ```

2. Backend:

   ```bash
   cd backend
   cp .env.example .env
   # отредактируйте DATABASE_URL
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```

   Сервер слушает `PORT` (по умолчанию 3000) и раздаёт статику из `../frontend`.

3. Откройте в браузере `http://127.0.0.1:3000/`.

### Учётные записи после seed

- `admin@fox.local` / `Admin12345!` — администратор  
- `manager@fox.local` / `Admin12345!` — менеджер  

### LLM

- В `.env`: `LLM_BASE_URL`, `LLM_MODEL` (например Ollama `http://127.0.0.1:11434/v1`, модель `llama3.2`).
- Для разработки и тестов: `LLM_MOCK=1` — ответы без реального LLM (заполнение полей по шагам).

### Telegram

- `TELEGRAM_BOT_TOKEN` — токен бота.
- `TELEGRAM_MANAGER_CHAT_IDS` — список chat_id через запятую. Без токена уведомление всё равно пишется в таблицу `notifications` со статусом (демо-режим).

## Тесты

```bash
cd backend
# задайте TEST_DATABASE_URL или DATABASE_URL на рабочий PostgreSQL
npm test
```

E2E (нужен запущенный backend с БД и `LLM_MOCK=1` в `.env` или в окружении):

```bash
npm install
cd backend && cp .env.example .env  # при необходимости
# из корня, при запущенном сервере или с webServer reuseExistingServer:
npx playwright install
npm run test:e2e
```

Нагрузочный скрипт-заготовка: `tests/perf/k6-consultation.js` (нужен установленный [k6](https://k6.io/)).

## Структура

- `backend/` — API (`/api/...`), Prisma, модули auth, consultations, serviceRequests, bookings, admin, analytics.
- `frontend/` — страницы, `css/`, `js/`.
- `specs/001-ai-consultation-platform/contracts/openapi.yaml` — контракт REST.

## Безопасность

JWT, RBAC по ролям, валидация Zod, ORM для SQL, Helmet и rate limit на `/api`. Не храните секреты в репозитории — только в `.env`.
