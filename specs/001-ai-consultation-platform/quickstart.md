# Quickstart: Express API + static HTML frontend

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)  
**Date**: 2026-03-24

## Prerequisites

- Node.js 20 LTS  
- PostgreSQL 16+  
- Ollama (или иной OpenAI-compatible локальный сервер)  
- Токен Telegram-бота  

## Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Пример переменных `backend/.env`:

- `DATABASE_URL` — PostgreSQL  
- `JWT_SECRET`, `JWT_EXPIRES_IN`  
- `LLM_BASE_URL`, `LLM_MODEL`  
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MANAGER_CHAT_IDS`  
- `PORT` (например 3000)  
- `CORS_ORIGIN` — при отдельной раздаче фронта (например `http://127.0.0.1:5500`) или origin статики  

## Frontend

**Вариант A**: Express раздаёт `frontend/`:

```js
app.use(express.static(path.join(__dirname, '../../frontend')));
```

**Вариант B**: Live Server / nginx только для HTML/CSS/JS — задать в JS базовый URL API
(`api.js`).

Открыть `index.html`, `consult.html`, `dashboards/*.html` в браузере с учётом CORS и cookie/localStorage для токена.

## Проверка API

Контракт: [contracts/openapi.yaml](./contracts/openapi.yaml) — импорт в Postman / Swagger UI.

## Тесты

```bash
cd backend
npm test
```

E2E (из корня репозитория после добавления конфигурации):

```bash
npx playwright test
```
