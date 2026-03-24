---
description: "Task list — AI consultation platform (Express + vanilla frontend)"
---

# Tasks: AI Consultation Platform for Car Service

**Input**: Design documents from `/specs/001-ai-consultation-platform/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: **MANDATORY** — unit, integration, e2e/UI, performance, security, plus manual acceptance (TR-001–008, constitution).

**Organization**: Phases by user story (US1–US4 from spec) after shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-friendly (different files, no blocking dependency)
- **[Story]**: `US1` … `US4` or `—` for shared

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository layout and tooling per [plan.md](./plan.md).

- [X] T001 [—] Create directory tree `backend/`, `frontend/` with subpaths from plan (html, css, js, dashboards, assets, prisma, modules)
- [X] T002 [—] Add `backend/package.json` with Express, Prisma, cors, helmet, express-rate-limit, jsonwebtoken, bcrypt (or argon2), zod, dotenv, telegraf (or node-telegram-bot-api), devDependencies jest, supertest, nodemon
- [X] T003 [P] [—] Add `backend/.env.example` with DATABASE_URL, JWT_*, LLM_*, TELEGRAM_*, PORT, CORS_ORIGIN (see [quickstart.md](./quickstart.md))
- [X] T004 [P] [—] Configure ESLint for `backend/` (JavaScript, Node)
- [X] T005 [P] [—] Configure Jest + Supertest for `backend/tests/`
- [X] T006 [P] [—] Add Playwright config at repo root (e.g. `playwright.config.js`) targeting `frontend/*.html`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, API shell, auth/RBAC — **no user story work before this checkpoint**.

- [X] T007 [—] Author full `backend/prisma/schema.prisma` for entities in [data-model.md](./data-model.md) (User, ConsultationSession, Message, ExtractedDiagnosticData, DiagnosticRecommendation, ServiceRequest, RequestFollowUpMessage, Notification, ConsultationScenario, ConsultationQuestion, Hint, ServiceCategory, ReferenceMaterial, enums for roles/statuses); заложить или добавить в следующей миграции сущности **ConsultationReport** и **ServiceBooking** (см. Phase 8)
- [X] T008 [—] Run initial migration `backend/prisma/migrations/*`; optional `prisma/seed.js` for dev admin/manager users
- [X] T009 [—] Implement `backend/src/app.js` + `server.js`: express.json, helmet, cors, rate-limit, static `frontend/` for dev
- [X] T010 [—] Implement `backend/src/middleware/authJwt.js` (Bearer JWT verification)
- [X] T011 [—] Implement `backend/src/middleware/requireRole.js` (CLIENT | MANAGER | ADMINISTRATOR)
- [X] T012 [—] Implement `backend/src/middleware/validate.js` (Zod schemas for bodies/query)
- [X] T013 [—] Implement `backend/src/modules/auth/` routes: POST `/api/auth/register`, POST `/api/auth/login` per [contracts/openapi.yaml](./contracts/openapi.yaml)
- [X] T014 [—] Implement `backend/src/modules/users/` GET/PATCH `/api/users/me`
- [X] T015 [—] Central error middleware + structured logging (e.g. pino) for FR-040 audit fields
- [X] T016 [—] Integration test `backend/tests/integration/auth.test.js`: register → login → JWT access to `/users/me`

**Checkpoint**: Foundation ready — user stories can start.

### Tests for Phase 2 (MANDATORY) ⚠️

- [X] T017 [P] [—] **Integration** auth + RBAC denial on wrong role in `backend/tests/integration/rbac.test.js`

---

## Phase 3: User Story 1 — Client consultation & service request (P1)

**Goal**: Client registers, completes AI consultation (six-field gate, FR-025b), creates service request.  
**Independent test**: Full flow without manager/admin UI.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T018 [P] [US1] **Unit** progress / six-field completeness in `backend/tests/unit/consultation-progress.test.js`
- [X] T019 [P] [US1] **Unit** LLM response parsing + error path (FR-025b) in `backend/tests/unit/ai-adapter.test.js`
- [X] T020 [US1] **Integration** consultation lifecycle in `backend/tests/integration/consultation.test.js` (start session → post messages → block completion until six fields → complete → create request)
- [X] T021 [P] [US1] **E2E** Playwright `tests/e2e/us1-client-consultation.spec.js`: register, login, consult, submit request, **save consultation report via API** (T058), optional booking submit (T060) (mock LLM or test double if needed)

### Implementation for User Story 1

- [X] T022 [US1] `backend/src/modules/consultations/` router: POST/GET sessions, GET session detail, POST `/:sessionId/messages` (calls AI module, persists USER+ASSISTANT messages, updates ExtractedDiagnosticData + progress)
- [X] T023 [US1] `backend/src/modules/ai/` LLM HTTP client (env LLM_BASE_URL, LLM_MODEL), prompt/JSON contract, map to diagnostics + recommendations; throw structured error on outage (FR-025b)
- [X] T024 [US1] Enforce FR-025a in service layer before allowing “complete” / request creation; persist preliminary disclaimer + confidence + cost “from” + probabilities
- [X] T025 [US1] `backend/src/modules/serviceRequests/` POST create from `consultationSessionId` (CLIENT only, session owner); status NEW (FR-028a)
- [X] T026 [P] [US1] `frontend/register.html` + `frontend/js/auth.js` (submit register, store token)
- [X] T027 [P] [US1] `frontend/login.html` + wire to `/api/auth/login`
- [X] T028 [P] [US1] `frontend/js/api.js` — base URL, `Authorization` header, JSON helpers
- [X] T029 [US1] `frontend/consult.html` + `frontend/js/consult.js` — chat UI, orange progress bar (FR-009), display recommendations/errors (FR-025b)
- [X] T030 [US1] `frontend/dashboards/client.html` + `frontend/js/dashboards/client.js` — consultation history, request list, consult link, **список сохранённых отчётов с сервера** (T059), переписка по заявкам; без локального-only хранения отчётов (FR-012)

**Checkpoint**: US1 end-to-end demonstrable.

---

## Phase 4: User Story 2 — Manager intake & Telegram (P2)

**Goal**: Manager lists/filters requests, views detail + full AI transcript, updates status, follow-up thread, receives Telegram on new request.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T031 [P] [US2] **Integration** `backend/tests/integration/service-requests-manager.test.js` (list, filter, get detail, PATCH status)
- [X] T032 [P] [US2] **Integration** `backend/tests/integration/telegram-notification.test.js` — mock Telegram sender; assert Notification row + payload after request creation (FR-029–030)
- [X] T033 [P] [US2] **Integration** `backend/tests/integration/request-messages.test.js` — post/list thread; 409 when status Completed/Cancelled (FR-016c)
- [ ] T034 [P] [US2] **E2E** Playwright `tests/e2e/us2-manager-dashboard.spec.js` — manager login, open request, change status, send follow-up (seed data or prior US1 flow)

### Implementation for User Story 2

- [X] T035 [US2] Extend `serviceRequests` router: GET `/api/service-requests` (MANAGER), GET/PATCH `/:id`, include client phone/email in detail DTO (FR-014, FR-016b); поддержка **оптимистичной блокировки** (`expectedVersion` или integer `version` в PATCH → 409 при конфликте, см. T064)
- [X] T036 [US2] `backend/src/modules/requestMessages/` GET/POST `/api/service-requests/:id/messages` with FR-016c guard
- [X] T037 [US2] `backend/src/modules/notifications/` — send Telegram on request create (after DB commit); persist Notification + retry fields (FR-030)
- [X] T038 [US2] `frontend/dashboards/manager.html` + `frontend/js/dashboards/manager.js` — table, filters, detail panel, status select, thread UI
- [X] T039 [US2] Document manager `TELEGRAM_MANAGER_CHAT_IDS` setup in README / quickstart

**Checkpoint**: US2 operational with notifications.

---

## Phase 5: User Story 3 — Administrator governance (P3)

**Goal**: User/role/block, scenarios + reference content, service categories, analytics summary.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T040 [P] [US3] **Integration** `backend/tests/integration/admin-users.test.js` — role change, block, forbidden for non-admin
- [ ] T041 [P] [US3] **Integration** `backend/tests/integration/admin-content.test.js` — CRUD scenario/question/hint/category/reference; assert new consultation reads active content (smoke)

### Implementation for User Story 3

- [X] T042 [US3] `backend/src/modules/admin/` routes: list users, PATCH role, POST block/unblock per FR-017
- [ ] T043 [US3] `backend/src/modules/reference/` (or under admin) CRUD for ConsultationScenario, ConsultationQuestion, Hint, ServiceCategory, ReferenceMaterial (FR-018)
- [X] T044 [US3] `backend/src/modules/analytics/` GET `/api/analytics/summary` for admin dashboard (FR-019)
- [X] T045 [US3] `frontend/dashboards/admin.html` + `frontend/js/dashboards/admin.js` — users table, content editors (minimal viable forms), analytics widgets

**Checkpoint**: US3 admin path complete.

---

## Phase 6: User Story 4 — Public site & responsive UX (P3)

**Goal**: Marketing pages, auth entry, responsive layout, brand rules (FR-031, FR-035–038).

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T046 [P] [US4] **Playwright** `tests/e2e/us4-public-pages.spec.js` — desktop + mobile viewport: home, about, gallery, works, location, login/register links
- [X] T047 [P] [US4] **Playwright** consult page: progress bar visible, chat bubbles layout (TR-004)

### Implementation for User Story 4

- [X] T048 [P] [US4] `frontend/index.html`, `about.html`, `gallery.html`, `works.html`, `location.html` — shared header/footer partial via copy or small JS include pattern
- [X] T049 [US4] `frontend/css/base.css`, `layout.css`, `components.css` — white background, orange/black accents, typography, touch targets, no orange-dominated backgrounds (FR-036–038)
- [X] T050 [US4] Responsive navigation (desktop bar + mobile collapsible) in CSS/JS
- [X] T051 [US4] `location.html` — embedded map (OSM/Google iframe per policy)
- [X] T052 [US4] `frontend/js/router-guard.js` — redirect unauthenticated users from dashboards; role mismatch → correct dashboard

**Checkpoint**: Public + responsive requirements satisfied.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Security, performance, docs, manual acceptance.

- [X] T053 [P] [—] **Security** automated suite `backend/tests/security/` or Jest tags: XSS-safe JSON responses, SQLi via Prisma only, JWT tampering, cross-role access (TR-006)
- [X] T054 [—] **Performance** script `tests/perf/k6-consultation.js` (or Artillery) — document p95 methodology for FR-042a–042b; optional FR-042c sampling notes
- [ ] T055 [—] **Manual** TR-007 checklist execution; record results for thesis appendix (usability, mobile, manager/admin flows)
- [X] T056 [P] [—] Root `README.md` — how to run backend, frontend, Prisma, Ollama, Telegram
- [X] T057 [—] Align implemented routes with [contracts/openapi.yaml](./contracts/openapi.yaml); update contract when API changes

---

## Phase 8: Устранение пробелов анализа (`/speckit.analyze`)

**Purpose**: закрыть П01 (бронирование), С01 (контракт), Н01 (серверные отчёты), частично П03 (конкурентное обновление статуса).

- [X] T058 [US1] Расширить `backend/prisma/schema.prisma`: сущность **ConsultationReport** (связь User + ConsultationSession, `snapshotJson`, `createdAt`); миграция; POST `/api/consultations/{sessionId}/report` в `modules/consultations/` (только владелец сессии, FR-012)
- [X] T059 [P] [US1] GET `/api/users/me/consultation-reports` + кнопка «Сохранить отчёт» на `frontend/consult.html` / `consult.js`, вызывающая T058 после завершения консультации
- [X] T060 [US1] Сущность **ServiceBooking** (clientId, optional serviceRequestId, preferredAt ISO или date+time, status, notes); `modules/bookings/` — POST/GET `/api/bookings` для CLIENT (FR-012, FR-020)
- [X] T061 [P] [US1] Форма и список записи на сервис в `dashboards/client.html` + `dashboards/client.js` (вызов T060)
- [X] T062 [US2] GET `/api/bookings` для MANAGER + отображение/смена статуса записи в `dashboards/manager.html` (минимум список + подтверждён/отменён)
- [X] T063 [P] [US2] **Integration** `backend/tests/integration/service-request-concurrency.test.js` — два параллельных PATCH с устаревшей версией → один 409
- [X] T064 [—] Сверить реализацию с [contracts/openapi.yaml](./contracts/openapi.yaml) **v0.3.0** (отчёты, бронирования, block/unblock, заготовки `/admin/reference/*`, `expectedVersion` на PATCH заявки); при расхождении править контракт или код и закрывать вместе с T057

---

## Dependencies & Execution Order

1. Phase 1 → Phase 2 (strict)  
2. Phase 3 (US1) — MVP  
3. Phase 4 (US2) — depends on T025 service request + auth  
4. Phase 5 (US3) — depends on Phase 2 admin routes safe to parallelize partly with US4  
5. Phase 6 (US4) — can overlap with US1 front pages after T009  
6. Phase 7 — after core flows  
7. **Phase 8** — после стабильного US1/US2 (можно параллелить T064 с началом Phase 3)

### Parallel Opportunities

- T003–T006 together; T018–T019; T026–T028; T031–T034; T040–T041; T046–T047; T048 with T049.

### Critical automated coverage (TR-008)

Registration/login, RBAC, consultation workflow + completion gate, result generation, service request creation, Telegram trigger (mocked OK in CI), manager processing, responsive UI (Playwright viewports), **серверное сохранение отчёта** — covered by T016–T017, T020–T021, T031–T034, T046–T047, T053, **T058–T059**; бронирование — **T060–T061**; конкуренция статусов — **T063**.

---

## Notes

- Write **failing tests** before implementation where feasible (US1–US4 test sections).  
- Commit after each task or logical group.  
- If OpenAPI diverges, update `contracts/openapi.yaml` in the same PR as code.

### `/speckit.implement` — оставшиеся пункты (2026-03-24)

| ID | Причина |
|----|---------|
| **T034** | E2E менеджера — только вход и таблица; нет сценария «открыть заявку → сменить статус → переписка». |
| **T041** | Интеграция справочников — созданы категория/сценарий; нет полного CRUD и smoke «новая консультация читает активный контент». |
| **T043** | В REST вынесены POST/GET категорий и сценариев под админом; вопросы, подсказки, материалы БЗ — сервисные функции без полного HTTP CRUD. |
| **T055** | Ручная приёмка TR-007 — выполняет автор ВКР, не автоматизируется. |
