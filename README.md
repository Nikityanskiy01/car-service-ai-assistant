# Интеллектуальный ассистент автосервиса

Веб-приложение для предварительной ИИ-консультации, управления заявками и записи на обслуживание.

## Стек

- frontend: React + Vite + TypeScript + React Router
- backend: Node.js + Express + Prisma
- database: PostgreSQL
- AI: Ollama / OpenAI-compatible

## Команды

```bash
npm run dev
npm run dev:frontend
npm run dev:backend
npm run build
npm run start
npm run test
npm run test:frontend
npm run test:backend
npm run test:e2e
npm run lint
npm run seed:demo
```

## Быстрый локальный запуск

```bash
docker compose up -d
npm --prefix frontend install
npm --prefix backend install
cp backend/.env.example backend/.env
npm --prefix backend run db:setup
npm run dev
```

Приложение в development: `http://127.0.0.1:5173`.

## Демо-режим и white-label

- White-label конфигурация фронтенда: `frontend/src/config/productConfig.ts`.
- Переключение светлой/тёмной темы и бренд-цветов: `frontend/src/theme/ThemeProvider.tsx`.
- Для демонстрационной среды используйте `npm run seed:demo`.
- Demo login включается через `DEMO_MODE=true` и переменные `DEMO_*` в `backend/.env`.
- Быстрый вход под ролями в UI доступен только при включённом `DEMO_MODE`.

## Production

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
docker compose --env-file .env.proxmox up -d --build
```

## Облачная LLM

```env
LLM_PROVIDER=openai
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_PROVIDER=ollama
LLM_CLOUD_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4.1-mini
```

## Документация

- **[Быстрый старт для коллеги](docs/ONBOARDING.md)** — порты, логины, типичные проблемы
- [Установка и запуск](docs/setup.md)
- [Архитектура](docs/architecture.md)
- [Тестирование](docs/testing.md)
- [Self-host на Proxmox](docs/proxmox-selfhost.md)
- [OpenAPI](specs/001-ai-consultation-platform/contracts/openapi.yaml)
