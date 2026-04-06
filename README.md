# Fox Motors — AI Auto Service

Веб-система первичной ИИ-консультации для автосервиса.

**Стек:** Express + Prisma + PostgreSQL | HTML/CSS/JS | Ollama + Qwen 2.5 | Telegram  

Версия Node для разработки: см. [`.nvmrc`](.nvmrc) (рекомендуется **22 LTS**).

## Быстрый старт

```bash
docker compose up -d                 # PostgreSQL + Ollama (модель скачается автоматически)
cd backend
npm install
cp .env.example .env
npm run db:setup                     # миграции + seed
npm run dev                          # http://127.0.0.1:3000
```

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
| [Архитектура проекта](docs/architecture.md) | Стек, структура папок, дерево файлов с описанием каждого |
| [Интеграция с ИИ](docs/ai-integration.md) | LLM-пайплайн, промпты, JSON-схемы, SSE-стриминг |
| [REST API](docs/api.md) | Все эндпоинты, параметры, коды ответов |
| [Схема БД](docs/database.md) | Модели, enum, связи, миграции |
| [Переменные окружения](docs/env-variables.md) | Полный справочник .env |
| [Тестирование](docs/testing.md) | Jest, Playwright, k6 — структура и запуск |
| [npm-скрипты](docs/scripts.md) | Все команды backend и Docker |
| [Деплой](docs/deployment.md) | Docker Compose, Render.com, VPS |
| [Отчёт аудита](docs/audit-report.md) | Безопасность, риски, рекомендации, статус CI |

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
