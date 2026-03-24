# Data Model: AI Consultation Platform

**Spec**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Date**: 2026-03-24

Logical model for **PostgreSQL** via **Prisma** (JavaScript). Enumerations and rules match
clarifications in spec (six-field completion gate, five request statuses, FR-016c thread lock).

---

## Enumerations

- **Role**: `CLIENT`, `MANAGER`, `ADMINISTRATOR`
- **ServiceRequestStatus**: `NEW`, `IN_PROGRESS`, `SCHEDULED`, `COMPLETED`, `CANCELLED` (UI labels:
  New, In progress, Scheduled, Completed, Cancelled)
- **ConsultationSessionStatus**: `IN_PROGRESS`, `COMPLETED`, `ABANDONED`, `AI_ERROR`
- **ConsultationMessageSender**: `USER`, `ASSISTANT`, `SYSTEM`
- **NotificationStatus**: `PENDING`, `SENT`, `FAILED`, `RETRYING`

---

## Core tables (user brief + spec)

| Entity | Purpose |
|--------|---------|
| **User** | Учётная запись: email, hash пароля, ФИО, телефон, опциональный email в профиле, роль, блокировка |
| **Role** | Либо enum на User, либо таблица Role + User.roleId — для ВКР достаточно enum на User |
| **ConsultationSession** | Сессия ИИ-консультации: клиент, статус, прогресс %, уверенность, стоимость «от», связь с категорией услуги |
| **Message** | Сообщения диалога консультации (не путать с перепиской по заявке) |
| **ExtractedDiagnosticData** | 1:1 к сессии: марка, модель, год, пробег, симптомы, условия |
| **ConsultationScenario** | Редактируемые сценарии (админ) |
| **ConsultationQuestion** | Шаблоны уточняющих вопросов |
| **Hint** | Подсказки для улучшения описания проблемы |
| **ServiceCategory** | Классификация услуг |
| **ReferenceMaterial** | Справочный контент / база знаний |
| **DiagnosticRecommendation** | Возможные неисправности с вероятностью для сессии |
| **ServiceRequest** | Заявка после завершённой консультации; снимки данных; статус |
| **Notification** | Попытки отправки Telegram и аудит |
| **RequestFollowUpMessage** | Внутренняя переписка по заявке (FR-016a–c) |
| **ConsultationReport** | Сохранённый на сервере снимок результата консультации (клиент, сессия, `snapshotJson`, метка/время) — FR-012 |
| **ServiceBooking** | Запись клиента на визит в сервис: клиент, опциональная заявка, предпочтительное время, статус, заметки — FR-012, FR-020 |

---

## Key rules

- Завершение консультации и создание заявки только при **непустых шести** полях
  ExtractedDiagnosticData (FR-025a).
- Новая заявка: статус **NEW**; смена статуса — **менеджер** (FR-015).
- При статусе заявки **COMPLETED** / **CANCELLED** — запрет **новых** RequestFollowUpMessage
  (FR-016c).
- История консультаций и заявок доступна в **личных кабинетах** согласно роли (FR-032–034).

---

## State notes

- **AI_ERROR**: сессия остаётся с сообщениями; повтор после восстановления LLM (FR-025b).
- Оптимистичная блокировка: целочисленное поле **`version`** (или эквивалент) на **ServiceRequest**;
  PATCH со `expectedVersion`; при несовпадении — **409** (см. tasks T035, T063, OpenAPI).
