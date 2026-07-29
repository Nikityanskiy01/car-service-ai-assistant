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

## Production

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
# задайте JWT_SECRET, INTEGRATION_ENCRYPTION_KEY, CORS_ORIGIN, DATABASE_URL
docker compose --env-file .env.proxmox up -d --build
# создайте пользователей (не коммитьте пароли):
# PROD_ADMIN_EMAIL=... PROD_ADMIN_PASSWORD=... \
# PROD_MANAGER_EMAIL=... PROD_MANAGER_PASSWORD=... \
# PROD_CLIENT_EMAIL=... PROD_CLIENT_PASSWORD=... \
#   npm --prefix backend run db:bootstrap:prod
```

Демо-вход и `DEMO_MODE` удалены. Вход только по email/паролю.

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

- **[Быстрый старт](docs/ONBOARDING.md)** — установка, порты, логины, LLM, типичные проблемы
- [Архитектура](docs/architecture.md)
- [Тестирование](docs/testing.md)
- [Self-host на Proxmox](docs/proxmox-selfhost.md)
- [Демо-сценарий](docs/demo-defense.md) · [Release readiness](docs/release-readiness.md)
- [OpenAPI](specs/001-ai-consultation-platform/contracts/openapi.yaml)
