# Тестирование

## Backend (Jest + Supertest)

Требование: запущенный Docker daemon (для PostgreSQL в контейнере) или локальная PostgreSQL с доступной тестовой БД.

```bash
cd backend
npm ci
# PostgreSQL для тестов (см. .github/workflows/ci.yml)
export DATABASE_URL=postgresql://fox:fox@localhost:5432/foxmotors_test
export TEST_DATABASE_URL=$DATABASE_URL
export JWT_SECRET=ci-test-jwt-secret-min-32-chars-long!!
export NODE_ENV=test
npx prisma migrate deploy
npm test
```

PowerShell-эквивалент переменных окружения:

```powershell
$env:DATABASE_URL="postgresql://fox:fox@localhost:5432/foxmotors_test"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:JWT_SECRET="ci-test-jwt-secret-min-32-chars-long!!"
$env:NODE_ENV="test"
```

### Покрытие

| Каталог | Содержание |
|---------|------------|
| `backend/tests/unit/` | Прогресс консультации, `consultation-flow`, `consultation-intent`, `consultation-prompts`, `diagnosis-agent`, `diagnostics-telemetry`, ai-adapter (парсинг/merge), политики пароля |
| `backend/tests/integration/` | auth, RBAC, consultation, service-requests, bookings, admin, contact, analytics |
| `backend/tests/security/` | JWT, XSS, cross-role |

Интеграционные тесты не требуют живой LLM — сетевые вызовы мокируются или обходятся на уровне сервиса.

### ИИ-диагностика (для главы 3 ВКР)

| Файл | Что проверяет |
|------|----------------|
| `diagnosis-agent.test.js` | шаги LLMFactory-агента, Zod-контракты |
| `diagnostics-telemetry.test.js` | счётчики и перцентили телеметрии |
| `consultation-intent.test.js` | intent diagnostic / service |
| `ai-adapter.test.js` | FR-025b: fallback при недоступной модели |

Ручная проверка телеметрии ИИ: `GET /api/health/ai-diagnostics` и `GET /api/health/ai-diagnostics/gates`.

## E2E (Playwright)

```bash
# из корня репозитория
npm install
cd backend && npm run dev   # или reuseExistingServer в CI
# другой терминал:
npm run test:e2e
```

Спеки: `tests/e2e/us1-client-consultation.spec.js` … `us4-public-pages.spec.js`.

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

- `lint` — ESLint backend
- `audit` — npm audit (high)
- `test` — Prisma migrate + Jest
- `e2e` — Playwright (при наличии job)

## Критический путь (соответствие ВКР)

Автоматизировано: регистрация, RBAC, цикл консультации, заявка, менеджер, гостевые сценарии, конкурентный PATCH заявки.  
Ручной прогон: usability и mobile — TR-007.
