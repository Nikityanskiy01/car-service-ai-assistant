# ADR 0001 — Modular monolith

- Status: accepted
- Date: 2026-08-16

Express-модули в `backend/src/modules/*`, один процесс API + отдельный worker.
Не выделяем микросервисы, пока нет отдельной команды и независимого масштабирования очереди/CRM.
