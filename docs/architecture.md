# Архитектура Fox Motors — AI Auto Service

## Обзор

Клиент-серверное веб-приложение: статический фронтенд, REST API на Node.js, PostgreSQL, cloud LLM через OpenAI-compatible API.

```mermaid
flowchart TB
  subgraph client [Клиент]
    Browser[Браузер HTML/CSS/JS]
  end
  subgraph server [Сервер Node.js Express]
    API[REST /api]
    Auth[JWT + RBAC]
    Consult[Консультации + SSE]
    AI[Гибрид rule-based + LLM]
    SR[Заявки и переписка]
    Admin[Админ и аналитика]
  end
  subgraph data [Данные и интеграции]
    PG[(PostgreSQL)]
    LLM[OpenAI-compatible LLM]
  end
  Browser --> API
  API --> Auth
  API --> Consult
  Consult --> AI
  AI --> LLM
  API --> SR
  API --> Admin
  Auth --> PG
  Consult --> PG
  SR --> PG
```

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `frontend/` | Публичные страницы, `consult.html`, дашборды ролей |
| `backend/src/app.js` | Express, middleware, статика frontend |
| `backend/src/routes/api.js` | Монтирование модулей `/api/*` |
| `backend/src/modules/` | auth, consultations, serviceRequests, admin, analytics, bookings |
| `backend/src/services/` | llmService, consultationFlowService, caseMemory |
| `backend/src/lib/` | diagnosticPlaybooks, pricing, workStats |
| `backend/prisma/` | schema, migrations, seed |
| `specs/001-ai-consultation-platform/` | ТЗ, OpenAPI, data-model |

## Поток консультации

1. Клиент/гость отправляет сообщения → `POST /api/consultations/:id/messages`.
2. Сервер извлекает 6 полей (марка, модель, год, пробег, симптомы, условия).
3. При полноте — `preAnalyzeSymptoms` + запрос к cloud LLM (JSON schema) → `mergeDiagnosis`.
4. При недоступности LLM (FR-025b) — fallback на rule-based без падения сессии.
5. Завершение → отчёт, `POST /api/service-requests` (клиент или гость).

## Роли (RBAC)

| Роль | Основные эндпоинты |
|------|-------------------|
| CLIENT | consultations, own requests, bookings, profile |
| MANAGER | all service-requests, messages, bookings list |
| ADMINISTRATOR | `/api/admin/*`, `/api/analytics/*` |

## Развёртывание

Локально: `docker compose` (Postgres + backend + frontend) + `backend` (`npm run db:setup`, `npm run dev`).  
Подробности: [setup.md](./setup.md).

## Связанные документы

- [setup.md](./setup.md) — установка
- [testing.md](./testing.md) — тесты
- [manual-acceptance-tr007.md](./manual-acceptance-tr007.md) — TR-007
- [demo-defense.md](./demo-defense.md) — сценарий защиты
- [specs/001-ai-consultation-platform/contracts/openapi.yaml](../specs/001-ai-consultation-platform/contracts/openapi.yaml) — REST API
