# Интеллектуальный ассистент автосервиса

Веб-приложение автосервиса: публичный сайт, ИИ-консультация, заявки, записи и кабинеты клиента, менеджера и администратора.

**Демо:** [autoservice-demo.zernov.online](https://autoservice-demo.zernov.online)

## Стек

- **Frontend:** React 19 + Vite + TypeScript + React Router
- **Backend:** Node.js + Express + Prisma
- **БД и очередь:** PostgreSQL 16, Redis 7 (BullMQ)
- **ИИ:** OpenAI-compatible API (VseLLM и аналоги) с fallback на Ollama / rule-based
- **Прод:** Docker Compose → Nginx на хосте

## Быстрый запуск (Docker)

Основной способ проверить продукт — тот же стек, что обслуживает демо:

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
# задайте JWT_SECRET, INTEGRATION_ENCRYPTION_KEY, CORS_ORIGIN, LLM_API_KEY

sudo docker compose --env-file .env.proxmox up -d --build
```

Сайт: `http://127.0.0.1:8080`. Подробности, учётки и LLM — в **[docs/ONBOARDING.md](docs/ONBOARDING.md)**.

## Локальная разработка frontend

Vite ходит в Docker-backend на `:3000`:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Открыть: `http://127.0.0.1:5173`.

## Команды

```bash
npm run lint
npm run build
npm run test:frontend
npm run test:backend
npm run test:e2e
npm run seed:demo
```

## Документация

- [Онбординг](docs/ONBOARDING.md)
- [Архитектура](docs/architecture.md)
- [Продукт и роли](docs/product.md)
- [Тестирование](docs/testing.md)
- [Деплой](docs/deploy.md)
- [Демо-сценарий](docs/demo.md)
- [Оглавление docs/](docs/README.md)
