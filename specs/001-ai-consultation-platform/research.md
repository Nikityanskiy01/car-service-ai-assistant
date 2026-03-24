# Research: AI Consultation Platform (Express + vanilla frontend)

**Feature**: `001-ai-consultation-platform`  
**Date**: 2026-03-24

Planning decisions aligned with the **Russian stack brief** (HTML5/CSS3/JS, Express, PostgreSQL,
local LLM, Telegram) and with [spec.md](./spec.md) / project constitution.

---

## 1. Frontend: static pages vs SPA framework

**Decision**: **Multi-page application (MPA)** — one HTML file per major route (home, about,
gallery, works, location, login, register, consult, three dashboards). Shared **CSS** layers
(`base`, `layout`, `components`) and **ES modules** under `frontend/js/` for `fetch` to REST,
token storage, chat UI, and dashboard tables.

**Rationale**: Matches thesis requirement for explicit HTML5/CSS3/JS without React/Vite; keeps
deployment simple (Express `static` middleware or any static host).

**Alternatives**: Single-page bundle with Vite — rejected by user brief; improves DX but violates
stated constraint.

---

## 2. Backend: Express modular monolith

**Decision**: Single **Express** app mounting **Routers** per domain module (`auth`, `users`,
`consultations`, `ai` adapter only used from consultations/service layer, `serviceRequests`,
`notifications`, `admin`, `reference`). **Central** error middleware and **Zod/Joi** validation
on body/query.

**Rationale**: User-mandated stack; clear mapping to thesis chapter “архитектура серверной части”.

**Alternatives**: NestJS — not used per new brief; Fastify — possible but Express specified.

---

## 3. PostgreSQL access

**Decision**: **Prisma** with **JavaScript** (`prisma/schema.prisma`, `prisma migrate`) for schema
evolution and **parameterized** queries.

**Rationale**: Reduces SQL injection risk (constitution), speeds migrations for many entities listed
by user (users, roles, sessions, messages, scenarios, hints, categories, recommendations,
requests, notifications).

**Alternatives**: `pg` + hand-written SQL — acceptable if Prisma disallowed; requires strict
parameterized queries everywhere.

---

## 4. Local LLM

**Decision**: Same as prior plan: **HTTP client** to **OpenAI-compatible** local server (default
**Ollama**). Consultation service parses **JSON-shaped** model output; on failure applies **FR-025b**
(no fabricated reply, session preserved, retry).

**Rationale**: Aligns with “локально развернутая модель” and spec.

---

## 5. Telegram

**Decision**: **Telegraf** (or equivalent) triggered after **committed** `ServiceRequest` +
`Notification` row; retries / `FAILED` status per FR-030.

---

## 6. JWT and RBAC

**Decision**: **Access JWT** in `Authorization: Bearer`; role claim `CLIENT` | `MANAGER` |
`ADMINISTRATOR`; `requireRole(...)` middleware on routers.

---

## 7. Testing mapping

| Уровень | Инструменты (рекомендация) |
|---------|----------------------------|
| Модульное | Jest / node:test — сервисы, прогресс, валидация DTO |
| Интеграционное | Supertest + тестовая БД Prisma |
| E2E / UI | Playwright — ключевые HTML-страницы и viewport |
| Безопасность | Негативные кейсы RBAC, инъекции, XSS-экранирование в шаблонах/JSON |
| Нагрузка | k6 / Artillery — сценарии консультаций и создания заявок |

---

## 8. Manager / administrator features (user brief)

**Decision**: Manager API + `dashboards/manager.html`: краткий результат диагностики, полный диалог,
карточка заявки, смена статуса, переписка по заявке (spec FR-016a–c). Administrator:
`dashboards/admin.html` + маршруты для пользователей, сценариев консультации, справочных
материалов, аналитики (FR-017–019).
