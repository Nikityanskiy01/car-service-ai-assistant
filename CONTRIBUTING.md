# Contributing

Production-стек — Docker Compose (`sudo docker compose --env-file .env.proxmox up -d --build`).
`npm run dev` не заменяет пересборку демо.

## Setup

```bash
npm ci
npm --prefix frontend ci
npm --prefix backend ci
cp backend/.env.example backend/.env
```

Отдельные lockfile у `frontend/` и `backend/` намеренные: Docker-образы ставят зависимости из своего контекста (`npm ci --omit=dev`). Корневые скрипты оркестрируют оба пакета.

## Checks

```bash
npm run lint
npm run openapi:check
npm run format:check
npm test
npx playwright test
```

Перед PR: не коммить секреты (`.env`, `.env.proxmox`).

## Hooks

```bash
npx lefthook install
```

## API

Контракт: `specs/001-ai-consultation-platform/contracts/openapi.yaml`.
`/api/v1/*` — alias тех же маршрутов `/api/*`.
Cursor-пагинация: `?cursor=` на `GET /consultations/staff` и `GET /bookings`.
