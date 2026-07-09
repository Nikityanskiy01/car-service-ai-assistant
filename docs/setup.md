# Установка и запуск

Пошаговая инструкция по локальному запуску.

## Требования

| Компонент | Версия |
|-----------|--------|
| Node.js | 22 LTS+ (фиксируется в `.nvmrc`) |
| npm | идёт с Node |
| Docker + Docker Compose | для PostgreSQL и Ollama |

## 1. Клонирование

```bash
git clone <url-репозитория>
cd car-service-ai-assistant
```

## 2. Docker-контейнеры (БД + LLM)

```bash
docker compose up -d
```

Поднимает:
- **PostgreSQL 16**
- **Ollama** (опционально, если используется локальный LLM)

## 3. Backend

```bash
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
npm --prefix backend run db:setup
npm run dev
```

Frontend в development работает на `http://127.0.0.1:5173`, backend API — на `http://127.0.0.1:3000`.

### Альтернативный ручной порядок (backend отдельно)

```bash
npm --prefix backend run prisma:migrate
npm --prefix backend run db:seed
npm --prefix backend run dev
```

## 4. Проверка LLM

```bash
cd backend
npm run llm:check
```

Если видите `LLM OK` — нейросеть работает. Если ошибка — проверьте, что Ollama запущена: `docker compose ps`.

## 5. Открыть в браузере

`http://127.0.0.1:5173/`

## Тестовые учётные записи

| Email | Пароль | Роль |
|-------|--------|------|
| `client@example.local` | `1q2w3e4r` | Клиент |
| `manager@example.local` | `1q2w3e4r5t` | Менеджер |
| `admin@example.local` | `1q2w3e4r5t6y` | Администратор |

## Ollama без Docker

Если предпочитаете локальную установку:

1. Скачайте [Ollama](https://ollama.com/) и установите
2. `ollama pull qwen2.5:7b`
3. В `backend/.env`:
   ```
   LLM_BASE_URL=http://127.0.0.1:11434
   LLM_MODEL=qwen2.5:7b
   ```

## Типичные проблемы

| Симптом | Решение |
|---------|---------|
| Порт 3000 занят | Смените `PORT` в `.env` |
| Prisma: таблица не найдена | `npx prisma migrate deploy` из `backend/` |
| Страница не открывается | Проверьте хост/порт, сверьте `CORS_ORIGIN` |
| ИИ не отвечает (503) | `docker compose ps` — запущена ли Ollama; `docker compose exec ollama ollama list` — скачана ли модель |
| PostgreSQL недоступен | `docker compose ps`, проверьте `DATABASE_URL` |
