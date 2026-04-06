# Схема базы данных

ORM: **Prisma** | БД: **PostgreSQL 16**

Схема: `backend/prisma/schema.prisma`  
Миграции: `backend/prisma/migrations/`

## ER-диаграмма (текстовая)

```
User ──────────┬──► ConsultationSession ──┬──► Message
               │                          ├──► ExtractedDiagnosticData (1:1)
               │                          ├──► DiagnosticRecommendation
               │                          ├──► ConsultationReport
               │                          └──► ServiceRequest (1:1 к сессии)
               ├──► ServiceRequest (как клиент) ──┬──► RequestFollowUpMessage
               │                                  ├──► Notification
               │                                  └──► ServiceBooking
               ├──► RequestFollowUpMessage (как автор)
               ├──► ConsultationReport
               ├──► ServiceBooking (clientId может быть null — гость)
               ├──► ServiceBookingAuditLog (actor — кто менял бронь)
               └──► RefreshToken

ServiceBooking ──► ServiceBookingAuditLog

ServiceCategory ──► ConsultationSession
                └──► ReferenceMaterial

ContactSubmission   (без связи с User)

ConsultationScenario ──► ConsultationQuestion
                     └──► Hint
```

## Перечисления (enum)

### Role
| Значение | Описание |
|----------|----------|
| `CLIENT` | Клиент (по умолчанию) |
| `MANAGER` | Менеджер сервиса |
| `ADMINISTRATOR` | Администратор системы |

### ServiceRequestStatus
| Значение | Описание |
|----------|----------|
| `NEW` | Новая заявка |
| `IN_PROGRESS` | В работе |
| `SCHEDULED` | Запланирована |
| `COMPLETED` | Завершена |
| `CANCELLED` | Отменена |

### ConsultationSessionStatus
| Значение | Описание |
|----------|----------|
| `IN_PROGRESS` | Идёт консультация |
| `COMPLETED` | Завершена |
| `ABANDONED` | Брошена |
| `AI_ERROR` | Ошибка ИИ |

### ConsultationMessageSender
| Значение | Описание |
|----------|----------|
| `USER` | Сообщение клиента |
| `ASSISTANT` | Сообщение ИИ |
| `SYSTEM` | Системное сообщение |

### NotificationStatus
| Значение | Описание |
|----------|----------|
| `PENDING` | Ожидает отправки |
| `SENT` | Отправлено |
| `FAILED` | Ошибка |
| `RETRYING` | Повторная попытка |

### BookingStatus
| Значение | Описание |
|----------|----------|
| `PENDING` | Ожидает подтверждения |
| `CONFIRMED` | Подтверждено |
| `CANCELLED` | Отменено |

## Модели

### User
Таблица: `users`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| email | String (unique) | Email для входа |
| passwordHash | String | Хэш пароля (bcrypt) |
| fullName | String | ФИО |
| phone | String | Телефон |
| emailProfile | String? | Email для профиля (опционально) |
| role | Role | Роль (CLIENT по умолчанию) |
| blocked | Boolean | Заблокирован (false по умолчанию) |
| createdAt | DateTime | Дата создания |
| updatedAt | DateTime | Дата обновления |

Связи: consultationSessions, serviceRequests, followUpMessages, consultationReports, serviceBookings

### ServiceCategory
Таблица: `service_categories`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| name | String | Название |
| slug | String (unique) | URL-slug |
| description | String? | Описание |

Связи: sessions (ConsultationSession), referenceMaterials

### ConsultationScenario
Таблица: `consultation_scenarios`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| title | String | Название сценария |
| description | String? | Описание |
| active | Boolean | Активен (true по умолчанию) |

Связи: questions (ConsultationQuestion), hints (Hint)

### ConsultationQuestion
Таблица: `consultation_questions`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| scenarioId | UUID (FK) | Ссылка на сценарий |
| order | Int | Порядок отображения |
| text | String | Текст вопроса |

### Hint
Таблица: `hints`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| scenarioId | UUID? (FK) | Ссылка на сценарий (опционально) |
| text | String | Текст подсказки |
| order | Int | Порядок |

### ReferenceMaterial
Таблица: `reference_materials`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| title | String | Название |
| body | String | Содержимое |
| categoryId | UUID? (FK) | Категория услуг |

### ConsultationSession
Таблица: `consultation_sessions`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор сессии |
| clientId | UUID? (FK) | Пользователь (null для гостей) |
| guestToken | String? (unique) | Токен гостевого доступа |
| guestName | String? | Имя гостя |
| guestPhone | String? | Телефон гостя |
| serviceCategoryId | UUID? (FK) | Категория услуг |
| status | ConsultationSessionStatus | Статус |
| progressPercent | Int | Прогресс (0–100) |
| confidencePercent | Int? | Уверенность диагностики |
| costFromMinor | Int? | Минимальная стоимость (копейки) |
| preliminaryNote | String? | Предварительное заключение |
| flowState | Json? | Состояние state machine (asked_questions, stage) |

Связи: client (User), serviceCategory, messages, extracted (1:1), recommendations, serviceRequest (1:1), reports

### Message
Таблица: `messages`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| sessionId | UUID (FK, indexed) | Сессия |
| sender | ConsultationMessageSender | Отправитель |
| content | String | Текст сообщения |
| createdAt | DateTime | Дата |

### ExtractedDiagnosticData
Таблица: `extracted_diagnostic_data`

| Поле | Тип | Описание |
|------|-----|----------|
| sessionId | UUID (PK, FK) | Сессия (1:1 связь) |
| make | String? | Марка автомобиля |
| model | String? | Модель |
| year | Int? | Год выпуска |
| mileage | Int? | Пробег (км) |
| symptoms | String? | Описание проблемы |
| problemConditions | String? | Условия проявления |

### DiagnosticRecommendation
Таблица: `diagnostic_recommendations`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| sessionId | UUID (FK, indexed) | Сессия |
| title | String | Текст рекомендации |
| probabilityPercent | Int | Вероятность (0–100) |

### ServiceRequest
Таблица: `service_requests`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| clientId | UUID? (FK, indexed) | Клиент |
| guestName | String? | Имя гостя |
| guestPhone | String? | Телефон гостя |
| guestEmail | String? | Email гостя |
| consultationSessionId | UUID (FK, unique) | Сессия-источник (1:1) |
| status | ServiceRequestStatus (indexed) | Статус |
| version | Int | Версия (optimistic locking) |
| snapshotMake | String? | Снимок марки |
| snapshotModel | String? | Снимок модели |
| snapshotSymptoms | String? | Снимок симптомов |

Связи: client, consultationSession, followUpMessages, notifications, bookings

### RequestFollowUpMessage
Таблица: `request_follow_up_messages`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| requestId | UUID (FK, indexed) | Заявка |
| authorId | UUID (FK) | Автор |
| body | String | Текст |

### Notification
Таблица: `notifications`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| serviceRequestId | UUID (FK, indexed) | Заявка |
| payload | String | Содержимое уведомления |
| status | NotificationStatus | Статус отправки |
| attempts | Int | Количество попыток |
| lastError | String? | Последняя ошибка |

### ConsultationReport
Таблица: `consultation_reports`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| userId | UUID (FK, indexed) | Пользователь |
| consultationSessionId | UUID (FK) | Сессия |
| snapshotJson | Json | Снимок данных консультации |
| label | String? | Метка |

### ServiceBooking
Таблица: `service_bookings`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| clientId | UUID? (FK, indexed) | Клиент (null для гостевой записи) |
| guestName | String? | Имя гостя |
| guestPhone | String? | Телефон гостя |
| guestEmail | String? | Email гостя |
| serviceRequestId | UUID? (FK) | Заявка (опционально) |
| preferredAt | DateTime | Желаемая дата/время |
| status | BookingStatus | Статус |
| notes | String? | Комментарий |

Связи: client, serviceRequest, auditLogs

### ServiceBookingAuditLog
Таблица: `service_booking_audit_logs`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| bookingId | UUID (FK) | Бронь |
| actorId | UUID (FK) | Кто изменил (пользователь) |
| changes | Json | Снимок изменённых полей |
| createdAt | DateTime | Время записи в журнале |

### ContactSubmission
Таблица: `contact_submissions`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| fullName | String | Имя |
| phone | String | Телефон |
| message | String? | Текст обращения |
| createdAt | DateTime | Время отправки |

### RefreshToken
Таблица: `refresh_tokens`

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID (PK) | Идентификатор |
| userId | UUID (FK, indexed) | Пользователь |
| token | String (unique) | SHA-256 хеш refresh-токена |
| expiresAt | DateTime (indexed) | Срок действия |
| createdAt | DateTime | Дата создания |

## Миграции

| Миграция | Описание |
|----------|----------|
| `20260324120000_init` | Начальная схема |
| `20260324180000_guest_consultations` | Гостевые консультации |
| `20260403120000_consultation_flow_state` | JSON-поле flowState |
| `20260405120000_add_guest_name_to_consultation_session` | Имя гостя |
| `20260406140000_sync_render_database_schema` | Синхронизация с Render |
| `20260406190000_add_refresh_tokens` | Таблица refresh-токенов |
| `20260406190100_add_consultation_session_indexes` | Индексы по сессиям |
| `20260406200000_add_contact_submissions` | Форма контактов |
| `20260406210000_guest_service_bookings` | Гостевые поля у бронирований |
| `20260406220000_service_booking_audit_logs` | Журнал правок бронирований |

Применение: `npx prisma migrate deploy` из `backend/`
