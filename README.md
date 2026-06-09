# Fox Motors — AI Auto Service

Веб-система первичной ИИ-консультации для автосервиса.

**Стек:** Express + Prisma + PostgreSQL | HTML/CSS/JS | OpenAI-compatible LLM  

Версия Node для разработки: см. [`.nvmrc`](.nvmrc) (рекомендуется **22 LTS**).

## Быстрый старт

Перед стартом убедиться, что Docker Desktop запущен (доступен Docker daemon).

```bash
docker compose up -d                 # PostgreSQL + backend + frontend
cd backend
npm install
cp .env.example .env
npm run db:setup                     # миграции + seed
npm run dev                          # http://127.0.0.1:3000
```

Для PowerShell вместо `cp` используйте:

```powershell
Copy-Item .env.example .env
```

## Production (Docker Compose)

Для self-host в production используется раздельный стек контейнеров:
- `frontend` (nginx со статикой и прокси `/api`);
- `backend` (Express API + Prisma migrations on start);
- `db` (PostgreSQL 16);

Быстрый запуск на сервере:

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
# отредактировать секреты и домен
docker compose --env-file .env.proxmox up -d --build
```

Подробно: [`docs/proxmox-selfhost.md`](docs/proxmox-selfhost.md).

### Cloud LLM (VseLLM)

В `backend/.env` укажите облачный провайдер:

```env
LLM_PROVIDER=openai
LLM_FALLBACK_ENABLED=false
LLM_CLOUD_BASE_URL=https://api.vsellm.ru/v1
LLM_API_KEY=vsellm_xxx
LLM_MODEL=qwen/qwen3-coder-next
```

Проверка: `cd backend && npm run llm:check` (ожидается `LLM OK`). Локальный Ollama и Telegram-бот **не используются**.

### Тестовые аккаунты

| Email | Пароль | Роль |
|-------|--------|------|
| `user@example.com` | `1q2w3e4r` | Клиент |
| `manager@example.com` | `1q2w3e4r5t` | Менеджер |
| `admin@example.com` | `1q2w3e4r5t6y` | Администратор |

## Документация

Полная документация находится в папке [`docs/`](docs/):

| Документ | Описание |
|----------|----------|
| [Установка и запуск](docs/setup.md) | Пошаговая инструкция, требования, типичные проблемы |
| [Архитектура проекта](docs/architecture.md) | Стек, модули, поток консультации, RBAC |
| [Тестирование](docs/testing.md) | Jest, Playwright, k6 — структура и запуск |
| [Приёмка TR-007](docs/manual-acceptance-tr007.md) | Ручная приёмка T055 (usability, mobile, роли) |
| [Self-host на Proxmox](docs/proxmox-selfhost.md) | VM bootstrap, Docker Compose, Nginx+TLS, systemd, backup, Remote SSH |
| OpenAPI | [specs/001-ai-consultation-platform/contracts/openapi.yaml](specs/001-ai-consultation-platform/contracts/openapi.yaml) |
| Модель данных | [specs/001-ai-consultation-platform/data-model.md](specs/001-ai-consultation-platform/data-model.md) |

Страницы фронтенда: помимо главной и консультации — [`services.html`](frontend/services.html) (каталог услуг), [`book-service.html`](frontend/book-service.html) (запись без аккаунта).

## Спецификации

```
specs/001-ai-consultation-platform/
├── spec.md             — спецификация (FR, TR, user stories)
├── data-model.md       — модель данных
└── contracts/openapi.yaml  — OpenAPI 3.0.3
```

## Лицензия

Проект создан как ВКР (выпускная квалификационная работа).
