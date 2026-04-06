# Деплой

## Локальная разработка

См. [setup.md](setup.md) — полная инструкция по локальному запуску.

## Docker Compose (локально)

Файл: `docker-compose.yml` в корне проекта.

```bash
docker compose up -d
```

### Сервисы

| Сервис | Образ | Порт | Описание |
|--------|-------|------|----------|
| `db` | `postgres:16-alpine` | `5433:5432` | PostgreSQL |
| `ollama` | `ollama/ollama:latest` | `11434:11434` | Ollama LLM |

### PostgreSQL

- Пользователь: `fox`
- Пароль: `fox`
- БД: `foxmotors`
- Тестовая БД `foxmotors_test` создаётся автоматически через `docker/postgres-init/01-create-test-db.sql`
- Данные хранятся в Docker volume `pgdata`

### Ollama

- При запуске автоматически скачивает модель `qwen2.5:7b` (при первом запуске ~4.7 GB)
- Данные моделей хранятся в volume `ollama_data`
- Entrypoint: запускает сервер → ждёт 3 секунды → `ollama pull qwen2.5:7b` → работает как сервер

## Render.com (production)

Файл: [`render.yaml`](../render.yaml) — Render Blueprint (один Web + PostgreSQL).

**ИИ на Render не входит в деплой:** Ollama, GPU и скачивание моделей не используются и **не настраиваются** в Blueprint. Задано `LLM_ENABLED=false` — сайт, заявки, запись, кабинеты работают; консультация использует эвристики без вызова нейросети (извлечение полей и диагностика деградируют на rule-based ветки в коде). Отдельный сервис ИИ на Render не нужен.

### Почему один сервис

Фронтенд обращается к API как к `window.location.origin + '/api'`. Отдельный **Static Site** на другом поддомене ломал бы авторизацию (cookie/CSRF на другом хосте). Сейчас **Express** в production отдаёт собранную папку `frontend/dist/` и API на том же origin.

### Сервисы

| Имя | Тип | Описание |
|-----|-----|----------|
| `ai-fox-motors-app` | web (Node) | `npm ci`, Prisma, сборка `../frontend`, `node src/server.js` |
| `ai-fox-motors-db` | PostgreSQL | Managed DB, `DATABASE_URL` в сервис |

### Сборка и запуск

```yaml
buildCommand: npm ci && npx prisma generate && npx prisma migrate deploy && cd ../frontend && npm ci && npm run build
startCommand: node src/server.js
healthCheckPath: /api/health
```

Переменные (часть задаётся Blueprint):
- `NODE_ENV=production`, `PORT=10000`
- `DATABASE_URL` — из связанной БД
- `JWT_SECRET` — `generateValue` в Blueprint
- `CORS_ORIGIN` — **не обязателен** на Render: если не задан, в `env.js` подставляется `RENDER_EXTERNAL_URL` (Render выставляет сам)
- `LLM_ENABLED=false` — нейросеть на Render не разворачивается (см. выше)

Кастомный домен: в Dashboard задайте `CORS_ORIGIN=https://ваш-домен` (без слэша в конце), чтобы совпадал с тем, с какого URL заходит браузер.

### Ограничения и ожидания

- **ИИ:** на Render не деплоится — это ожидаемо; полноценный LLM только локально (Docker) или на своём VPS с Ollama.
- Free plan — возможен cold start (30+ секунд).

## Ручной деплой на VPS

1. Установите Docker + Docker Compose на VPS
2. Склонируйте репозиторий
3. `docker compose up -d` — поднимет PostgreSQL + Ollama
4. Настройте `backend/.env` (измените `JWT_SECRET`, `CORS_ORIGIN`, `DATABASE_URL`)
5. `cd backend && npm install && npm run db:setup && npm start`
6. Настройте reverse proxy (nginx) на порт 3000

### PDF на Linux-сервере

Для `GET …/export.pdf` нужен TTF с кириллицей (например пакет `fonts-dejavu-core`) или переменная `PDF_BODY_FONT` с путём к шрифту — иначе возможна ошибка `PDF_FONT_MISSING`.
