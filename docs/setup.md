# Установка и запуск

Пошаговая инструкция по развёртыванию AI Fox Motors локально.

## Требования

| Компонент | Версия |
|-----------|--------|
| Node.js | 22 LTS+ (фиксируется в `.nvmrc`) |
| npm | идёт с Node |
| Docker + Docker Compose | для PostgreSQL и контейнеров приложения |

## 1. Клонирование

```bash
git clone <url-репозитория>
cd car-service-ai-assistant
```

## 2. Docker-контейнеры

```bash
docker compose up -d
```

Поднимает:
- **PostgreSQL 16** на порту `5433` (пользователь `fox`, пароль `fox`, БД `foxmotors`)
- **Backend API** на `3000`
- **Frontend** на `8080`

## 3. Backend

```bash
cd backend
npm install
cp .env.example .env    # при первом запуске
npm run db:setup        # миграции + seed
npm run dev             # запуск в режиме разработки (nodemon)
```

Сервер слушает `http://127.0.0.1:3000` и раздаёт фронтенд из `../frontend`.

### Альтернативный ручной порядок

```bash
cd backend
npx prisma migrate deploy   # применить миграции
npm run db:seed              # создать тестовых пользователей
npm run dev
```

## 4. Проверка LLM

```bash
cd backend
npm run llm:check
```

Если видите `LLM OK` — нейросеть работает. Если ошибка — проверьте `LLM_CLOUD_BASE_URL` и `LLM_API_KEY` в `backend/.env`.

## 5. Открыть в браузере

```
http://127.0.0.1:3000/
```

Или `http://<ваш-LAN-IP>:3000` с другого устройства в сети (CORS разрешает в development).

## Тестовые учётные записи

| Email | Пароль | Роль |
|-------|--------|------|
| `user@example.com` | `1q2w3e4r` | Клиент |
| `manager@example.com` | `1q2w3e4r5t` | Менеджер |
| `admin@example.com` | `1q2w3e4r5t6y` | Администратор |

Дополнительно (E2E):
- `admin@fox.local` / `Admin12345!` — администратор
- `manager@fox.local` / `Admin12345!` — менеджер

## Cloud LLM (VseLLM)

Используется OpenAI-compatible endpoint:

```env
LLM_PROVIDER=openai
LLM_CLOUD_BASE_URL=https://api.vsellm.ru/v1
LLM_API_KEY=vsellm_xxx
LLM_MODEL=qwen/qwen3-coder-next
```

### Режимы диагностики (опционально)

См. полный список в `backend/.env.example`:

```env
CONSULTATION_FLOW_MODE=llm_first
DIAGNOSIS_AGENT_MODE=llmfactory
DIAGNOSIS_AGENT_PROFILE=compact
DIAGNOSIS_TURN_BUDGET_MS=20000
DIAGNOSIS_FAST_PATH_ENABLED=true
```

Проверка после изменений: `npm run llm:check` и один прогон консультации на `/consult.html` (SSE + итоговый диагноз).

## Типичные проблемы

| Симптом | Решение |
|---------|---------|
| Порт 3000 занят | Смените `PORT` в `.env` |
| Prisma: таблица не найдена | `npx prisma migrate deploy` из `backend/` |
| Страница не открывается | Проверьте хост/порт, сверьте `CORS_ORIGIN` |
| ИИ не отвечает (503) | Проверить `LLM_API_KEY`, `LLM_CLOUD_BASE_URL`, баланс/лимиты у провайдера |
| PostgreSQL недоступен | `docker compose ps`, проверьте `DATABASE_URL` |
