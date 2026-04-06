# Тестирование

## Структура тестов

```
backend/tests/
├── setup.js                  # настройка окружения (DATABASE_URL, TEST_DATABASE_URL)
├── global-setup.js           # ensure-test-db + prisma migrate reset --skip-seed
├── helpers.js                # утилиты для тестов (createUser, loginAs...)
├── unit/                     # юнит-тесты
│   ├── consultation-flow.test.js    # логика state machine, extraction
│   ├── consultation-progress.test.js # расчёт прогресса
│   ├── booking-hours.test.js        # окно записи по МСК
│   ├── password-policy.test.js      # политика пароля
│   └── contact-phone.test.js        # нормализация телефона
├── integration/              # API-тесты (supertest)
│   ├── auth.test.js                         # регистрация, вход, JWT, cookie
│   ├── consultation.test.js                 # консультации, сообщения, отчёты
│   ├── rbac.test.js                         # контроль ролей
│   ├── admin-users.test.js                  # управление пользователями
│   ├── admin-content.test.js                # управление контентом
│   ├── service-requests-manager.test.js     # заявки (менеджер)
│   ├── service-request-concurrency.test.js  # optimistic locking
│   ├── request-messages.test.js             # переписка по заявке
│   ├── bookings-guest.test.js               # гостевая запись
│   ├── bookings-audit.test.js               # аудит бронирований
│   ├── contact-form.test.js                 # форма контактов
│   └── telegram-notification.test.js        # Telegram-уведомления
└── security/
    └── security.test.js      # тесты безопасности (XSS, инъекции, rate limit)

tests/
├── e2e/                      # Playwright E2E
│   ├── us1-client-consultation.spec.js   # полный цикл клиента
│   ├── us2-manager-dashboard.spec.js     # дашборд менеджера
│   ├── us4-consult-layout.spec.js        # вёрстка консультации
│   └── us4-public-pages.spec.js          # публичные страницы
└── perf/
    └── k6-consultation.js    # нагрузочный тест
```

## Юнит и интеграционные тесты (Jest)

### Запуск

```bash
cd backend
npm test
```

Или в режиме наблюдения:

```bash
npm run test:watch
```

### Требования

- PostgreSQL запущен (тестовая БД `foxmotors_test`)
- Если `TEST_DATABASE_URL` не задан, используется `DATABASE_URL`
- Тестовая БД создаётся автоматически скриптом `docker/postgres-init/01-create-test-db.sql` при первом запуске контейнера или командой `npm run db:ensure-test`

### Конфигурация

- `backend/jest.config.js` — конфигурация Jest (ESM: `node --experimental-vm-modules … jest`)
- `backend/tests/setup.js` — устанавливает `DATABASE_URL` на тестовую БД, очищает Telegram-токен
- `backend/tests/global-setup.js` — перед прогоном: `ensure-test-database` (если есть) и `prisma migrate reset --force --skip-seed` (схема без seed; пользователей создают сами тесты)

### Что тестируется

| Область | Файл | Что проверяет |
|---------|------|---------------|
| Auth | `auth.test.js` | Регистрация, вход, валидация, дубликаты email |
| RBAC | `rbac.test.js` | Доступ по ролям, блокировка |
| Consultations | `consultation.test.js` | Создание сессии, сообщения, гостевой доступ, claim |
| Service Requests | `service-requests-manager.test.js` | CRUD заявок, фильтрация |
| Concurrency | `service-request-concurrency.test.js` | Optimistic locking при параллельных PATCH |
| Messages | `request-messages.test.js` | Переписка клиент-менеджер |
| Admin | `admin-users.test.js`, `admin-content.test.js` | Управление пользователями и контентом |
| Telegram | `telegram-notification.test.js` | Создание уведомлений, отправка |
| Security | `security.test.js` | XSS, SQL-инъекции, rate limit |
| Flow | `consultation-flow.test.js` | Логика state machine, extraction, merge |
| Progress | `consultation-progress.test.js` | Расчёт процента заполненности |
| Bookings | `bookings-guest.test.js`, `bookings-audit.test.js` | Гостевая бронь, журнал аудита |
| Contact | `contact-form.test.js` | POST контактов, доступ staff |
| Password / phone | `password-policy.test.js`, `contact-phone.test.js` | Политика и телефон |

## CI (GitHub Actions)

Файл `.github/workflows/ci.yml`:

- **lint** — ESLint в `backend/`
- **audit** — `npm audit --omit=dev --audit-level=high`
- **test** — PostgreSQL 16 service, `prisma migrate deploy`, `npm test`

E2E Playwright в CI **не запускаются** (только локально / вручную).

## E2E-тесты (Playwright)

### Установка

```bash
# из корня проекта
npm install
npx playwright install
```

### Запуск

```bash
npm run test:e2e
```

### Требования

- Backend запущен с БД и Ollama
- Конфигурация: `playwright.config.js` (baseURL: `http://127.0.0.1:3000`)
- Playwright автоматически запускает webServer, если `reuseExistingServer: true` и сервер уже запущен — использует существующий

### Сценарии

| Файл | Описание |
|------|----------|
| `us1-client-consultation.spec.js` | Полный цикл: регистрация → консультация → диагностика → заявка |
| `us2-manager-dashboard.spec.js` | Дашборд менеджера: список заявок, смена статуса |
| `us4-consult-layout.spec.js` | Проверка вёрстки страницы консультации |
| `us4-public-pages.spec.js` | Публичные страницы: главная, услуги, галерея, контакты |

## Нагрузочное тестирование (k6)

```bash
# требуется установленный k6: https://k6.io/
k6 run tests/perf/k6-consultation.js
```

Скрипт симулирует параллельные консультации через API.

## Дымовой тест консультации

```bash
cd backend
npm run smoke:consultation
```

Скрипт `scripts/smoke-consultation.js` выполняет полный цикл консультации через API без браузера.
