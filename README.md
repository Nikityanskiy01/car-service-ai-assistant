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
| [Архитектура проекта](docs/architecture.md) | Стек, модули, поток консультации, RBAC |
| [Тестирование](docs/testing.md) | Jest, Playwright, k6 — структура и запуск |
| [Демо к защите](docs/demo-defense.md) | Золотой путь 7–10 мин, учётки, чеклист 3× прогона |
| [Приёмка TR-007](docs/manual-acceptance-tr007.md) | Ручная приёмка T055 (usability, mobile, роли) |
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
