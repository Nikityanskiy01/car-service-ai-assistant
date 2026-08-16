# ADR 0002 — Compose, not Render

- Status: accepted
- Date: 2026-08-16

Канонический деплой — Docker Compose (Proxmox/демо). `render.yaml` в корне устарел
(нет worker, Redis AOF, pgvector, OTel) и помечен deprecated. Не использовать для новых стендов.
