# Тестирование

## Быстрый прогон

```bash
npm run lint
npm run build
npm run test:frontend
npm run test:backend
npm run test:e2e
```

Дополнительно: `npm run test:ai` (safety + сценарии консультации).
Инвентарь API и OpenAPI: `npm run routes:check && npm run openapi:check`.

## Backend — Jest + Supertest

Нужен PostgreSQL. Скрипт `backend/scripts/run-tests.mjs` берёт `TEST_DATABASE_URL` или `DATABASE_URL`, иначе fallback `localhost:5433/car_service_test`.

Локально Compose **не** публикует Postgres. Варианты:

- как в CI: отдельный контейнер Postgres на `5432` и `TEST_DATABASE_URL`;
- пробросить порт `db` сами и указать URL;
- запускать тесты внутри CI.

```bash
cd backend
export DATABASE_URL=postgresql://car_service_app:change-me@localhost:5432/car_service_test
export TEST_DATABASE_URL=$DATABASE_URL
export JWT_SECRET=ci-test-jwt-secret-min-32-chars-long!!
export NODE_ENV=test
npx prisma migrate deploy
npm test
```

Интеграционные тесты **не требуют живую LLM** — провайдер мокируется или отключается.

| Каталог | Что покрыто |
|---------|-------------|
| `backend/tests/unit/` | Прогресс консультации, flow, merge диагноза, пароли, OBD, circuit breaker, кэш |
| `backend/tests/integration/` | auth, RBAC, консультации, заявки, записи, админ, контакт, Telegram (mock) |
| `backend/tests/security/` | JWT, XSS, cross-role |
| `backend/tests/eval/` | Регрессия промптов (38 сценариев), `npm --prefix backend run test:eval` |

## Frontend — Vitest + Testing Library

```bash
npm run test:frontend
```

Ключевые сценарии: API-клиент (refresh 401, CSRF), route guards, формы входа/регистрации/записи, консультация, SSE-парсер, 404.

## E2E — Playwright

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
npm run test:e2e
```

Спеки в `tests/e2e/`:

- `migration-flow.spec.js` — критический путь
- `admin-nav-smoke.spec.js` — зоны админки и `Ctrl+K`
- `ai-consultation-timeout-regression.spec.js`
- `ui-review.spec.js` — визуальный smoke, артефакты в `artifacts/ui-review/`

Playwright поднимает Vite на `http://127.0.0.1:5173` (`reuseExistingServer: true`). В CI `LLM_ENABLED=false`.

## Eval промптов и нагрузка

```bash
npm --prefix backend run test:eval
k6 run tests/perf/k6-consultation.js
# BASE_URL=http://127.0.0.1:3000 JWT=<token> k6 run ...
```

Порог в k6-скрипте: p95 ответа консультации. Для отчёта фиксируйте VU, длительность и факт прохождения.

## Demo seed

```bash
npm run seed:demo
# или в контейнере:
sudo docker compose --env-file .env.proxmox exec backend node prisma/seed.demo.js
```

Не запускайте demo-seed на базе с боевыми клиентами.

## CI

GitHub Actions [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

| Job | Что делает |
|-----|------------|
| `lint` | ESLint frontend + backend |
| `build` | production build frontend + prisma generate |
| `test-frontend` | Vitest |
| `test-backend` | Postgres 16 service + migrate + Jest |
| `e2e` | Playwright + Chromium, LLM выключен |

## Критический путь приёмки

Автоматизировано: регистрация, RBAC, цикл консультации, заявка, менеджер, гостевые сценарии, конкурентный PATCH заявки, обход админ-навигации.

Ручной золотой путь для демо: [demo.md](./demo.md).
