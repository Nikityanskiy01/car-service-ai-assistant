# REST API

Все эндпоинты доступны по префиксу `/api`.

**Аутентификация (production):** access и refresh JWT выставляются в **httpOnly**-cookie (`fm_at`, `fm_rt`) при `register` / `login` / `refresh`. Запросы с фронтенда отправляют `credentials: 'include'`. В JSON ответа приходит только объект `user` (без токенов).

**CSRF:** если у клиента есть auth-cookie, для `POST`/`PUT`/`PATCH`/`DELETE` (кроме `/auth/login`, `/auth/register`, `/auth/refresh`) нужен заголовок `X-CSRF-Token`, совпадающий с cookie `fm_csrf` (double-submit). Без auth-cookie (гостевой режим) проверка не требуется.

**Тесты (`NODE_ENV=test`):** допускается `Authorization: Bearer <access>` и в теле ответа логина/регистрации возвращаются `accessToken` / `refreshToken` для supertest.

Полный OpenAPI-контракт: `specs/001-ai-consultation-platform/contracts/openapi.yaml` (может отставать от кода — сверяйте с этим файлом и роутерами).

## Система

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/api/health` | публичный | Проверка БД: `200 { status, db }` или `503` при недоступности PostgreSQL |

---

## Аутентификация

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/api/auth/register` | публичный | Регистрация, выставляет cookie |
| POST | `/api/auth/login` | публичный | Вход, выставляет cookie |
| POST | `/api/auth/refresh` | публичный | Новая пара токенов; refresh берётся из cookie `fm_rt` |
| POST | `/api/auth/logout` | публичный | Очистка cookie и отзыв refresh в БД |

### POST /api/auth/register

Пароль: не менее **8** символов, **латинские** буквы и **цифра**, кириллица не допускается (см. `passwordPolicy.js`).

```json
{
  "email": "user@example.com",
  "password": "Passw0rd",
  "fullName": "Иван Иванов",
  "phone": "+79991234567"
}
```

### POST /api/auth/login

```json
{
  "email": "user@example.com",
  "password": "Passw0rd"
}
```

Ответ (production): `{ "user": { ... } }`. В тестах дополнительно: `accessToken`, `refreshToken`.

### POST /api/auth/refresh

Тело не требуется: refresh-token в cookie `fm_rt`.

Ответ: как у login (production — только `user`).

### POST /api/auth/logout

Тело не требуется. Ответ: `{ "ok": true }`, cookie очищаются.

---

## Контакты (форма на сайте)

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/api/contact` | публичный | Отправка формы: `fullName`, `phone`, опционально `message` |
| GET | `/api/contact` | MANAGER / ADMINISTRATOR | Список обращений (новые сверху) |

### POST /api/contact

```json
{
  "fullName": "Иван",
  "phone": "+79991234567",
  "message": "Вопрос по записи"
}
```

Ответ: `201 { "ok": true, "id": "uuid" }`.

---

## Пользователи

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/api/users/me` | авторизованный | Текущий профиль |
| PATCH | `/api/users/me` | авторизованный | Обновить профиль (fullName, phone, emailProfile) |
| GET | `/api/users/me/consultation-reports` | авторизованный | Мои отчёты консультаций |

---

## Консультации

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/api/consultations` | публичный / CLIENT | Создать сессию (гость или клиент) |
| GET | `/api/consultations` | CLIENT | Список моих сессий |
| GET | `/api/consultations/staff` | MANAGER / ADMINISTRATOR | Пагинированный список сессий (`limit`, `offset`) |
| GET | `/api/consultations/:sessionId` | владелец / гость / MANAGER | Детали сессии |
| GET | `/api/consultations/:sessionId/export.pdf` | владелец / гость / MANAGER | PDF отчёта консультации |
| POST | `/api/consultations/:sessionId/messages` | владелец / гость | Отправить сообщение (синхронно) |
| POST | `/api/consultations/:sessionId/messages/stream` | владелец / гость | Отправить сообщение (SSE-стриминг) |
| POST | `/api/consultations/:sessionId/claim` | CLIENT | Привязать гостевую сессию к аккаунту |
| POST | `/api/consultations/:sessionId/report` | CLIENT | Сохранить отчёт консультации |
| POST | `/api/consultations/:sessionId/service-request` | CLIENT | Создать заявку из консультации |
| POST | `/api/consultations/:sessionId/service-request-guest` | гость | Создать заявку гостем (с контактами) |
| GET | `/api/consultations/context/active-templates` | CLIENT | Активные шаблоны сценариев |

### Гостевой доступ

При создании сессии без авторизации возвращается `guestToken`. Для последующих запросов передаётся в заголовке `X-Consultation-Guest-Token`.

### SSE endpoint (messages/stream)

Возвращает `Content-Type: text/event-stream`. События:
- `thinking` — начало обработки
- `progress` — фаза (extracting, extracted, diagnosing)
- `done` — полные данные сессии
- `error` — ошибка (LLM_ERROR при 503)

---

## Заявки в сервис

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/api/service-requests` | авторизованный | Список заявок (клиент видит свои, менеджер — все) |
| GET | `/api/service-requests/:requestId/export.pdf` | авторизованный | PDF карточки заявки и переписки (доступ как у GET деталей) |
| GET | `/api/service-requests/:requestId` | авторизованный | Детали заявки |
| PATCH | `/api/service-requests/:requestId` | MANAGER / ADMINISTRATOR | Изменить статус (optimistic locking через expectedVersion) |

### Фильтрация GET /api/service-requests

Query-параметры:
- `status` — `NEW`, `IN_PROGRESS`, `SCHEDULED`, `COMPLETED`, `CANCELLED`
- `q` — текстовый поиск
- `page`, `pageSize` — пагинация (по умолчанию 1 и 20)
- `sort` — `createdAt` | `client` | `car` | `status` | `version`
- `dir` — `asc` | `desc`

### PATCH /api/service-requests/:requestId

```json
{
  "status": "IN_PROGRESS",
  "expectedVersion": 1
}
```

---

## Переписка по заявке

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/api/service-requests/:requestId/messages` | авторизованный | Список сообщений |
| POST | `/api/service-requests/:requestId/messages` | авторизованный | Написать сообщение |

### POST body

```json
{ "body": "Текст сообщения" }
```

---

## Бронирование

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/api/bookings/guest` | публичный | Запись без аккаунта (контакты + слот времени) |
| POST | `/api/bookings` | CLIENT | Создать бронь |
| GET | `/api/bookings` | авторизованный | Список броней (у staff — `limit`/`offset` до 200/500) |
| GET | `/api/bookings/:bookingId/audit` | ADMINISTRATOR | Журнал изменений записи |
| PATCH | `/api/bookings/:bookingId` | MANAGER / ADMINISTRATOR | Статус, время, заметки, контакты гостя |

Время записи проверяется на стороне сервера: **09:00–21:00 по Москве** (21:00 уже вне окна).

### POST /api/bookings/guest

```json
{
  "preferredAt": "2026-04-10T10:00:00.000Z",
  "fullName": "Иван",
  "phone": "+79991234567",
  "email": "a@b.ru",
  "notes": "Замена масла",
  "serviceTitle": "ТО",
  "categoryLabel": "Обслуживание"
}
```

### POST /api/bookings

```json
{
  "preferredAt": "2026-04-10T10:00:00Z",
  "serviceRequestId": "uuid (опционально)",
  "notes": "Комментарий (опционально)"
}
```

### PATCH /api/bookings/:bookingId

Допустимо одно или несколько полей:

```json
{
  "status": "CONFIRMED",
  "preferredAt": "2026-04-11T14:00:00.000Z",
  "notes": "Подтверждено",
  "guestName": "Иван",
  "guestPhone": "+79991234567",
  "guestEmail": "a@b.ru"
}
```

При изменении полей брони менеджером/админом пишется запись в `service_booking_audit_logs`.

---

## Администрирование

Все эндпоинты требуют роль `ADMINISTRATOR`.

### Пользователи

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/users` | Список всех пользователей |
| PATCH | `/api/admin/users/:userId/role` | Сменить роль (`CLIENT`, `MANAGER`, `ADMINISTRATOR`) |
| POST | `/api/admin/users/:userId/block` | Заблокировать |
| POST | `/api/admin/users/:userId/unblock` | Разблокировать |

### Контент (справочники)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/reference/service-categories` | Список категорий услуг |
| POST | `/api/admin/reference/service-categories` | Создать категорию |
| PATCH | `/api/admin/reference/service-categories/:id` | Обновить |
| DELETE | `/api/admin/reference/service-categories/:id` | Удалить |
| GET | `/api/admin/reference/scenarios` | Список сценариев |
| POST | `/api/admin/reference/scenarios` | Создать сценарий |
| PATCH | `/api/admin/reference/scenarios/:id` | Обновить |
| DELETE | `/api/admin/reference/scenarios/:id` | Удалить |
| GET | `/api/admin/reference/scenarios/:id/questions` | Вопросы сценария |
| POST | `/api/admin/reference/scenarios/:id/questions` | Добавить вопрос |
| PATCH | `/api/admin/reference/questions/:id` | Обновить вопрос |
| DELETE | `/api/admin/reference/questions/:id` | Удалить вопрос |
| GET | `/api/admin/reference/scenarios/:id/hints` | Подсказки сценария |
| POST | `/api/admin/reference/scenarios/:id/hints` | Добавить подсказку |
| PATCH | `/api/admin/reference/hints/:id` | Обновить подсказку |
| DELETE | `/api/admin/reference/hints/:id` | Удалить подсказку |
| GET | `/api/admin/reference/reference-materials` | Справочные материалы |
| POST | `/api/admin/reference/reference-materials` | Создать материал |
| PATCH | `/api/admin/reference/reference-materials/:id` | Обновить |
| DELETE | `/api/admin/reference/reference-materials/:id` | Удалить |

---

## Аналитика

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/api/analytics/summary` | ADMINISTRATOR | Сводная статистика |

---

## Безопасность

- **JWT** — в production в httpOnly-cookie `fm_at` / `fm_rt`; заголовок Bearer не используется фронтендом
- **CSRF** — cookie `fm_csrf` (не httpOnly) + заголовок `X-CSRF-Token` для мутаций при наличии auth-cookie
- **RBAC** — роли CLIENT, MANAGER, ADMINISTRATOR; middleware `requireRole`
- **Валидация** — Zod-схемы на каждый endpoint
- **Rate limiting** — `express-rate-limit` на `/api`
- **Helmet** — HTTP security headers
- **ORM** — Prisma, без raw SQL
- **CORS** — настраивается через `CORS_ORIGIN` (в development — любой origin)

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Невалидные данные (Zod validation) |
| 401 | Не авторизован / невалидный JWT |
| 403 | Недостаточно прав или неверный CSRF (`code: CSRF`) |
| 404 | Ресурс не найден |
| 409 | Конфликт версий (optimistic locking) |
| 503 | LLM недоступна (`LLM_ERROR`) или БД по `/api/health` |
