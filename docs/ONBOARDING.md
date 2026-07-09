# Быстрый старт для разработчика

Краткая шпаргалка: как поднять проект, войти в кабинеты и не сломать себе вход.

## Что это за проект

Веб-приложение автосервиса: публичный сайт, ИИ-консультация, заявки, кабинеты клиента / менеджера / администратора, интеграции с CRM (backend).

**Стек:** React (Vite + TS) · Node.js + Express + Prisma · PostgreSQL · LLM (VseLLM / Ollama / OpenAI-compatible).

---

## 1. Первый запуск

```bash
git clone https://github.com/Nikityanskiy01/car-service-ai-assistant.git
cd car-service-ai-assistant

docker compose up -d

npm --prefix backend install
npm --prefix frontend install

cp backend/.env.example backend/.env
# отредактируйте backend/.env: DATABASE_URL, LLM_* при необходимости

npm --prefix backend run db:setup
npm run dev
```

| Сервис | URL по умолчанию |
|--------|------------------|
| Frontend (Vite) | http://127.0.0.1:5173 |
| Backend API (Docker) | http://127.0.0.1:3000/api |
| PostgreSQL (хост) | localhost:5433 |

Подробнее: [docs/setup.md](setup.md).

---

## 2. Два режима backend — важно для входа

На машине могут одновременно работать **два** backend:

| Режим | Порт | База | Как запущен |
|-------|------|------|-------------|
| **Docker** | 3000 | внутренняя `car_service` | `docker compose up` |
| **Локальный dev** | 3001 (или 3000) | из `backend/.env` | `npm --prefix backend run dev` |

**Vite по умолчанию проксирует `/api` на порт 3000** (Docker).

Если вы создали пользователей через `npm run db:seed` в `backend/.env` (например `foxmotors_test` на :5433), а frontend ходит на Docker — **логин не сработает**.

### Решение A — работать через Docker

```bash
docker compose exec backend node prisma/seed.js
```

Учётки Docker (другие email):

| Роль | Email | Пароль |
|------|--------|--------|
| Клиент | `user@example.com` | `1q2w3e4r` |
| Менеджер | `manager@example.com` | `1q2w3e4r5t` |
| Админ | `admin@example.com` | `1q2w3e4r5t6y` |

### Решение B — локальный backend на 3001

```bash
# терминал 1
$env:PORT=3001; npm --prefix backend run dev

# терминал 2 — скопируйте frontend/.env.example → frontend/.env.local
npm --prefix frontend run dev
```

В `frontend/.env.local`:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:3001
```

Учётки после `npm --prefix backend run db:seed`:

| Роль | Email | Пароль |
|------|--------|--------|
| Клиент | `client@example.local` | `1q2w3e4r` |
| Менеджер | `manager@example.local` | `1q2w3e4r5t` |
| Админ | `admin@example.local` | `1q2w3e4r5t6y` |

Проверка пользователей в БД:

```bash
cd backend
node scripts/list-users.mjs
node scripts/verify-login.mjs
```

---

## 3. Куда заходить после логина

| Роль | URL |
|------|-----|
| Клиент | `/dashboard/client` |
| Менеджер | `/dashboard/manager` |
| Администратор | `/dashboard/admin` |

### Менеджер

- Рабочий стол — `/dashboard/manager`
- Заявки (список / канбан) — `/dashboard/manager/requests`
- Карточка заявки — `/dashboard/manager/requests/:id`
- Календарь — `/dashboard/manager/calendar`
- Клиенты — `/dashboard/manager/clients`
- Обращения с сайта — `/dashboard/manager/contacts`

### Администратор

- Обзор — `/dashboard/admin`
- Пользователи — `/dashboard/admin/users`
- Интеграции — `/dashboard/admin/integrations`
- Аналитика — `/dashboard/admin/analytics`
- Журнал — `/dashboard/admin/audit`

---

## 4. Полезные команды

```bash
# всё сразу (frontend + backend)
npm run dev

# только frontend / backend
npm run dev:frontend
npm run dev:backend

# миграции и seed
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run db:seed:demo   # демо-заявки и данные

# тесты
npm run lint
npm run build
npm run test:frontend
npm run test:backend
npm run test:e2e
npm run test:ai

# проверка LLM
npm --prefix backend run llm:check
```

---

## 5. LLM (ИИ-консультация)

В `backend/.env` типичная настройка для облака:

```env
LLM_PROVIDER=openai
LLM_CLOUD_BASE_URL=https://api.vsellm.ru/v1
LLM_API_KEY=<ваш ключ>
LLM_MODEL=qwen3.5-flash
```

Локально через Ollama:

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=qwen2.5:7b
```

Проверка: `npm --prefix backend run llm:check`.

---

## 6. Частые проблемы

| Симптом | Причина | Что сделать |
|---------|---------|-------------|
| «Требуется авторизация» при входе | Неверный email или frontend бьёт не в ту БД | См. раздел 2 |
| `Too many attempts` | Rate limit на `/auth/login` | Подождать 15 мин или `docker compose restart backend` |
| Порт 5173 занят | Старый Vite | Закрыть процесс или открыть URL из консоли (5174…) |
| ИИ не отвечает | LLM недоступен | `llm:check`, проверить ключ и URL |
| `db:seed` прошёл, вход не работает | Seed в другую БД, чем backend | Сверить `DATABASE_URL` и порт прокси |

---

## 7. Документация

- [Установка](setup.md)
- [Архитектура](architecture.md)
- [Тестирование](testing.md)
- [OpenAPI](../specs/001-ai-consultation-platform/contracts/openapi.yaml)

---

## 8. Секреты

**Не коммитьте:** `backend/.env`, `frontend/.env.local`, ключи API.

Шаблоны: `backend/.env.example`, `frontend/.env.example`.
