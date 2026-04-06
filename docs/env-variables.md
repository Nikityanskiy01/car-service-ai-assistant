# Переменные окружения

Файл: `backend/.env` (копируется из `backend/.env.example`)

Валидация: Zod-схема в `backend/src/config/env.js`

## Обязательные

| Переменная | Тип | Пример | Описание |
|------------|-----|--------|----------|
| `DATABASE_URL` | string | `postgresql://fox:fox@localhost:5433/foxmotors` | Строка подключения PostgreSQL |
| `JWT_SECRET` | string (min 16) | `change-me-in-production-min-32-chars-long!!` | Секрет для подписи JWT-токенов |

## С значениями по умолчанию

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `NODE_ENV` | `development` | Режим: `development`, `test`, `production` |
| `PORT` | `3000` | Порт HTTP-сервера |
| `JWT_EXPIRES_IN` | `30m` | Время жизни access JWT |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Время жизни refresh-токена (дни) |
| `LLM_BASE_URL` | `http://127.0.0.1:11434` | Адрес Ollama (native API, без `/v1`) |
| `LLM_MODEL` | `qwen2.5:7b` | Модель для LLM |
| `LLM_ENABLED` | `true` | Включить/выключить LLM (`true`/`false`). При `false` — rule-based fallback |

## Опциональные

| Переменная | Описание |
|------------|----------|
| `CORS_ORIGIN` | В **production** обязателен, если нет **`RENDER_EXTERNAL_URL`** (на Render URL сервиса подставляется автоматически в `env.js`). В `development` не задан — CORS допускает любой origin (`origin: true`) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота для уведомлений |
| `TELEGRAM_MANAGER_CHAT_IDS` | Chat ID менеджеров через запятую. Без токена уведомления записываются в таблицу `notifications` |
| `TEST_DATABASE_URL` | Используется скриптами Jest / `global-setup.js` (не входит в Zod-схему `env.js`) |
| `PDF_BODY_FONT` | Полный путь к `.ttf` с кириллицей для PDFKit (Linux без системных шрифтов) |
| `PDF_BRAND_NAME` | Название в шапке PDF (по умолчанию «Автоассистент») |

## Пример .env

```env
DATABASE_URL="postgresql://fox:fox@localhost:5433/foxmotors"
PORT=3000
NODE_ENV=development
JWT_SECRET="change-me-in-production-min-32-chars-long!!"
JWT_EXPIRES_IN=30m
REFRESH_TOKEN_EXPIRES_DAYS=7
LLM_ENABLED=true
CORS_ORIGIN=http://localhost:3000
LLM_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=qwen2.5:7b
TELEGRAM_BOT_TOKEN=
TELEGRAM_MANAGER_CHAT_IDS=

TEST_DATABASE_URL="postgresql://fox:fox@localhost:5433/foxmotors_test"

# PDF (опционально; см. комментарии в backend/.env.example)
# PDF_BODY_FONT=
# PDF_BRAND_NAME=
```

## Docker Compose и переменные

При использовании `docker compose up -d` из корня репозитория:

- PostgreSQL доступен на `localhost:5433` (user: `fox`, password: `fox`, db: `foxmotors`)
- Ollama доступна на `localhost:11434`

Эти значения уже прописаны в `.env.example` по умолчанию.

## Production (Render)

В `render.yaml` задаются:
- `NODE_ENV=production`
- `PORT=10000`
- `DATABASE_URL` — из Render PostgreSQL
- `JWT_SECRET` — генерируется автоматически
- Ollama на Render отсутствует — LLM-функции недоступны (503)
