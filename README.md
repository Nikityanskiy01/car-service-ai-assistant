# Fox Motors — AI Auto Service

Веб-система первичной ИИ-консультации для автосервиса.

**Стек:** Express + Prisma + PostgreSQL | HTML/CSS/JS | Ollama / OpenAI-compatible LLM | Telegram  

Версия Node для разработки: см. [`.nvmrc`](.nvmrc) (рекомендуется **22 LTS**).

## Быстрый старт

Перед стартом убедиться, что Docker Desktop запущен (доступен Docker daemon).

```bash
docker compose up -d                 # PostgreSQL + Ollama (модель скачается автоматически)
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
- `ollama` (локальная LLM).

Быстрый запуск на сервере:

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
# отредактировать секреты и домен
docker compose --env-file .env.proxmox up -d --build
```

Подробно: [`docs/proxmox-selfhost.md`](docs/proxmox-selfhost.md).

### Облачная LLM вместо локальной

В `backend/.env` переключите провайдер:

```env
LLM_PROVIDER=openai
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_PROVIDER=ollama
LLM_CLOUD_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4.1-mini
```

После этого `backend` будет использовать `/chat/completions` облачного провайдера.  
Если облако недоступно, сервис автоматически переключится на fallback-провайдер (`ollama` или `openai`).

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
| [Демо к защите](docs/demo-defense.md) | Золотой путь 7–10 мин, учётки, чеклист 3× прогона |
| [Приёмка TR-007](docs/manual-acceptance-tr007.md) | Ручная приёмка T055 (usability, mobile, роли) |
| [Self-host на Proxmox](docs/proxmox-selfhost.md) | VM bootstrap, Docker Compose, Nginx+TLS, systemd, backup, Remote SSH |
| OpenAPI | [specs/001-ai-consultation-platform/contracts/openapi.yaml](specs/001-ai-consultation-platform/contracts/openapi.yaml) |
| Модель данных | [specs/001-ai-consultation-platform/data-model.md](specs/001-ai-consultation-platform/data-model.md) |

Страницы фронтенда: помимо главной и консультации — [`services.html`](frontend/services.html) (каталог услуг), [`book-service.html`](frontend/book-service.html) (запись без аккаунта).

## Спецификации

Проектная документация (ТЗ, план, контракт API):

```
specs/001-ai-consultation-platform/
├── spec.md             — спецификация (FR, TR, user stories)
├── plan.md             — план реализации
├── tasks.md            — чеклист задач
├── data-model.md       — модель данных
├── research.md         — исследование технологий
├── quickstart.md       — краткий старт
├── contracts/openapi.yaml  — OpenAPI 3.0.3
└── checklists/         — чеклисты требований
```

## Лицензия

Проект создан как ВКР (выпускная квалификационная работа).
