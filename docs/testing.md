# Тестирование

## Быстрый прогон

```bash
npm run lint
npm run build
npm run test:frontend
npm run test:backend
npm run test:e2e
```

## Backend (Jest + Supertest)

Требование: запущенный Docker daemon (для PostgreSQL в контейнере) или локальная PostgreSQL с доступной тестовой БД.

```bash
cd backend
npm ci
# PostgreSQL для тестов (см. .github/workflows/ci.yml)
export DATABASE_URL=postgresql://car_service_app:change-me@localhost:5432/car_service_test
export TEST_DATABASE_URL=$DATABASE_URL
export JWT_SECRET=ci-test-jwt-secret-min-32-chars-long!!
export NODE_ENV=test
npx prisma migrate deploy
npm test
```

PowerShell-эквивалент переменных окружения:

```powershell
$env:DATABASE_URL="postgresql://car_service_app:change-me@localhost:5432/car_service_test"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:JWT_SECRET="ci-test-jwt-secret-min-32-chars-long!!"
$env:NODE_ENV="test"
```

### Покрытие

| Каталог | Содержание |
|---------|------------|
| `backend/tests/unit/` | Прогресс консультации, rule-based flow, ai-adapter (парсинг/merge), политики пароля |
| `backend/tests/integration/` | auth, RBAC, consultation, service-requests, bookings, admin, contact, telegram (mock) |
| `backend/tests/security/` | JWT, XSS, cross-role |

Интеграционные тесты **не требуют Ollama** — LLM мокируется или обходится на уровне сервиса.

## E2E (Playwright)

```bash
# из корня репозитория
npm install
npm --prefix backend install
npm --prefix frontend install
npm run test:e2e
```

Спеки: `tests/e2e/migration-flow.spec.js`.

Визуальный smoke-check и скриншоты для демо:

```bash
npx playwright test tests/e2e/ui-review.spec.js
```

Артефакты сохраняются в `artifacts/ui-review/`.

## Frontend (Vitest + React Testing Library)

Покрываются ключевые сценарии:
- API-клиент (refresh после 401, CSRF заголовок);
- route guards (auth + role);
- формы входа/регистрации/гостевой записи;
- базовый рендер консультации;
- SSE parser;
- React 404.

## Demo seed

```bash
npm run seed:demo
```

Команда заполняет демонстрационную среду и не вызывается автоматически в production.

## Нагрузка (k6)

```bash
k6 run tests/perf/k6-consultation.js
# BASE_URL=http://127.0.0.1:3000 JWT=<token> k6 run ...
```

Методика FR-042: порог `p(95)<5000` ms в скрипте; для отчёта ВКР — зафиксировать VU, длительность и факт прохождения порога.

## Ручная приёмка TR-007

Протокол: [manual-acceptance-tr007.md](./manual-acceptance-tr007.md) (T055).

## CI

GitHub Actions [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- `lint` — frontend + backend ESLint
- `build` — production build frontend + prisma generate
- `test-frontend` — Vitest
- `test-backend` — Prisma migrate + Jest
- `e2e` — Playwright (при наличии job)

## Критический путь (соответствие ВКР)

Автоматизировано: регистрация, RBAC, цикл консультации, заявка, менеджер, гостевые сценарии, конкурентный PATCH заявки.  
Ручной прогон: usability и mobile — TR-007.
