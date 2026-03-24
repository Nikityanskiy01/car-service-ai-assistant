# Implementation Plan: AI Consultation Platform for Car Service

**Branch**: `001-ai-consultation-platform` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)

**Input**: User planning constraints (RU, 2026-03-24): frontend on **HTML5, CSS3, JavaScript**
with responsive layout; public pages (home, about, gallery, works, location, auth, AI
consultation) and role dashboards (client, manager, administrator); white/orange/black UI with
header logo, consultation dialog, progress bar. Backend on **Node.js + Express.js** (JavaScript),
modular architecture; **PostgreSQL** persistence; local NLP/LLM module; **Telegram Bot API** for
manager notifications after new service requests. Testing: unit, integration, e2e, UI, security,
load.

## Summary

Build a client-server web system: **multi-page / hybrid frontend** (static HTML, shared CSS,
vanilla JS modules) consuming a **REST JSON API** from **Express**. Modules cover authentication,
users, consultations (sessions + messages + extracted diagnostics + progress), AI orchestration,
service requests and statuses, Telegram notifications, administration of scenarios and reference
materials, and analytics-oriented admin endpoints. Data in **PostgreSQL**; access layer via
**Prisma Client** (JavaScript) for migrations and parameterized queries aligned with SQL-injection
mitigation. Local LLM reached through a small HTTP adapter (OpenAI-compatible / Ollama-style).

## Technical Context

**Language/Version**: JavaScript (ES2022+), Node.js 20 LTS; HTML5 / CSS3 in frontend  
**Primary Dependencies**: **Express 4**, `cors`, `helmet`, `express-rate-limit`, `jsonwebtoken`,
`bcrypt` (or `argon2`), **Prisma Client** + `@prisma/client`, `zod` or `joi` for request
validation; **Telegraf** (or `node-telegram-bot-api`) for Telegram  
**Storage**: PostgreSQL 16+  
**Testing**: **Jest** or **Node test runner** + **Supertest** (API); **Playwright** (e2e + UI
across viewports); optional **k6** / Artillery for load; security-focused suites for RBAC and
injection  
**Target Platform**: Server: Linux/Windows; clients: evergreen desktop and mobile browsers  
**Project Type**: Web application — `frontend/` (static) + `backend/` (Express API)  
**Performance Goals**: Per [spec.md](./spec.md) FR-042a–042c (p95 chat visibility ≤5s, ≥50
concurrent consultations, ≥99% monthly availability excl. maintenance)  
**Constraints**: LLM runs **locally**; no third-party LLM SaaS for consultation processing; REST
only between UI and API; JWT + RBAC on protected routes; FR-025b AI outage behavior  
**Scale/Scope**: Single-tenant car service; multiple managers/admins; MVP phased via `/speckit.tasks`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|--------|
| Architecture | **Pass** | Client-server, responsive web UI, modular Node (Express), REST, PostgreSQL, local LLM |
| Roles / RBAC | **Pass** | Client, manager, administrator; middleware + route-level checks; matches spec FR-004–019 |
| AI diagnostics | **Pass** | Six-field gate, progress, clarifications, preliminary result, cost “from”, probabilities, FR-025b |
| Security | **Pass** | JWT, validation, ORM/parameterized DB, helmet/cors discipline, audit logging per FR-040 |
| Testing | **Pass** | Unit, integration, e2e, UI, performance, security explicitly in user requirements + spec TR-* |

**Post-design**: OpenAPI in `contracts/openapi.yaml` remains valid for REST surface; frontend
delivery mechanism is static assets + `fetch`, not a SPA framework — no constitution conflict.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-consultation-platform/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── spec.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── index.html              # главная
├── about.html              # описание автосервиса
├── gallery.html
├── works.html              # наши работы
├── location.html           # местоположение / карта
├── login.html
├── register.html
├── consult.html            # ИИ-консультация (диалог + прогресс-бар)
├── dashboards/
│   ├── client.html
│   ├── manager.html
│   └── admin.html
├── css/
│   ├── base.css            # типографика, сетка, переменные (белый фон, оранжевый/чёрный)
│   ├── layout.css
│   └── components.css      # шапка с логотипом, чат, прогресс-бар, карточки кабинетов
├── js/
│   ├── api.js              # обёртка fetch к REST
│   ├── auth.js
│   ├── router-guard.js     # редиректы по роли
│   ├── consult.js          # логика чата и прогресса
│   ├── dashboards/
│   │   ├── client.js
│   │   ├── manager.js
│   │   └── admin.js
│   └── utils.js
└── assets/
    └── images/             # логотип и медиа

backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── middleware/
│   │   ├── authJwt.js
│   │   ├── requireRole.js
│   │   └── validate.js
│   └── modules/
│       ├── auth/           # регистрация, вход, выдача JWT
│       ├── users/
│       ├── consultations/# сессии, сообщения, прогресс, завершение
│       ├── ai/             # клиент локального LLM, разбор JSON-ответа
│       ├── serviceRequests/
│       ├── requestMessages/# переписка по заявке (spec FR-016a–c)
│       ├── notifications/# Telegram + запись статусов
│       ├── admin/          # пользователи, сценарии, справочники, аналитика
│       └── reference/      # сценарии, вопросы, подсказки, категории, материалы
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/                # опционально совместно с корневым Playwright
```

**Structure Decision**: Static **MPA** frontend (HTML per screen) with shared JS/CSS; **Express**
backend with **feature modules** under `src/modules/*`, Prisma for PostgreSQL.

## Complexity Tracking

No constitution violations. User-mandated stack (vanilla front + Express) is **compatible** with
project constitution (modular Node.js, REST, PostgreSQL, local LLM).

## Phase 0 & Phase 1 Outputs

- [research.md](./research.md) — стек, модули, доступ к данным, LLM, Telegram.
- [data-model.md](./data-model.md) — сущности и правила (согласованы с перечнем пользователя).
- [contracts/openapi.yaml](./contracts/openapi.yaml) — REST-контракт (без изменения семантики ролей).
- [quickstart.md](./quickstart.md) — запуск Express, статика, Prisma, Ollama, Telegram.
