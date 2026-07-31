# Переосмысление роли CLIENT — рабочий документ

> Связанные материалы: [ai-improvement-roadmap.md](./ai-improvement-roadmap.md), [architecture.md](./architecture.md).

**Статус:** ✅ Фазы A–E реализованы — MVP кабинета CLIENT готов к использованию  
**Последнее обновление:** 2026-07-30  
**Охват:** frontend + backend + миграции + тесты + Docker production-стек

---

## Содержание

1. [Цель и результат](#цель-и-результат)
2. [Полный отчёт о реализации](#полный-отчёт-о-реализации)
3. [Ментальная модель Case](#ментальная-модель-case)
4. [Информационная архитектура](#информационная-архитектура)
5. [Экраны — детальная спецификация](#экраны--детальная-спецификация)
6. [API и backend](#api-и-backend)
7. [Сквозные UX-паттерны](#сквозные-ux-паттерны)
8. [Инвентарь файлов](#инвентарь-файлов)
9. [Тесты](#тесты)
10. [Backlog](#backlog)
11. [Журнал прогресса](#журнал-прогресса)

---

## Цель и результат

### Цель

Не «ещё один кабинет», а **личный центр обслуживания автомобиля**: клиент видит одну историю от симптома до визита в сервис, а не разрозненные сущности БД.

**Принцип каждого экрана:** отвечать на вопрос *«что мне делать дальше?»*

### Итог по фазам

| Фаза | Название | Срок (план) | Статус |
|------|----------|-------------|--------|
| **A** | Починить доверие | 3–5 дней | ✅ Готово |
| **B** | Обращения вместо разрозненности | 1–2 недели | ✅ Готово |
| **C** | Главная с умом | 1 неделя | ✅ Готово |
| **D** | Записи как продукт | 1 неделя | ✅ Готово |
| **E** | Полировка | ongoing | ✅ Готово |

### Что изменилось для пользователя (до → после)

| Было | Стало |
|------|-------|
| Запись гостем даже будучи залогиненным — запись не в кабинете | Auth CLIENT → запись сразу в «Мои записи» |
| Гостевая консультация терялась после регистрации | Авто-claim сессии после login/register |
| «Заявки», «Консультации», «Записи» — три разных мира | Один раздел **«Мои обращения»** (Case) |
| Главная — 4 бессмысленных счётчика | Контекстный hero + лента активных дел |
| Запись — строка в списке | Детальная страница: .ics, отмена, связь с обращением |
| Профиль спрятан в меню пользователя | Профиль в сайдбаре + вкладки (авто, уведомления) |
| Непонятно, есть ли ответ менеджера | Бейдж непрочитанных + баннер на главной |
| На мобилке — только бургер-меню | Bottom nav: Главная / Обращения / Записи / Ещё |

---

## Полный отчёт о реализации

### Фаза A — «Починить доверие»

> Без этого кабинет «врал» пользователю: данные создавались, но не отображались.

#### A1. Запись в сервис для авторизованного клиента

**Файл:** `frontend/src/pages/public/BookingPage.tsx`

- Если `user.role === 'CLIENT'` → `POST /api/bookings` с телом `{ preferredAt, notes, serviceRequestId? }`
- Если гость → `POST /api/bookings/guest` (как раньше)
- Для auth-клиента контакты берутся из профиля (не дублируются в форме)
- Prefill из `sessionStorage` (`STORAGE_KEYS.bookingPrefill`) — после консультации или с детали обращения

**Тесты:** `frontend/src/pages/public/BookingPage.test.tsx`

#### A2. Claim гостевой консультации

**Файлы:**
- `frontend/src/features/consultations/claimGuestSession.ts` — `claimGuestConsultationSessionIfPresent()`
- `frontend/src/pages/auth/LoginPage.tsx` — вызов после успешного входа
- `frontend/src/pages/auth/RegisterPage.tsx` — вызов после регистрации

**Логика:**
1. Читает `consultSessionId` + `consultGuestToken` из `sessionStorage`
2. `POST /api/consultations/:id/claim` с `{ guestToken }`
3. При успехе удаляет `consultGuestToken`

**Тесты:** `frontend/src/features/consultations/claimGuestSession.test.ts`

#### A3. Профиль в сайдбаре

**Файл:** `frontend/src/config/dashboardNav.ts`

Добавлен пункт:
```ts
{ id: 'client-profile', label: 'Профиль', to: '/dashboard/client/profile', icon: User }
```

Убрана отдельная группа «Действия» — дублировала главную.

#### A4. Человеческие названия консультаций

**Backend:** `consultations.router.js` → `serializeSessionList()` возвращает `make`, `model`, `symptoms`, `extracted`

**Frontend:**
- `frontend/src/lib/consultationLabels.ts` — `formatConsultationTitle()`, `formatConsultationSubtitle()`
- Формат: `{make} {model} — {symptom}` вместо `Сессия A1B2C3D4`

**Тесты:** `frontend/src/lib/consultationLabels.test.ts`

#### A5. Backend-тест записи клиента

**Файл:** `backend/tests/integration/bookings-client.test.js`
- `POST /api/bookings` создаёт запись с `clientId`
- Запись видна в `GET /api/bookings`

---

### Фаза B — «Обращения вместо разрозненности»

> Один экран «Мои обращения» заменяет «Заявки» + «Консультации».

#### B1. Виртуальная сущность Case

**Frontend:** `frontend/src/features/client-cases/buildClientCases.ts`  
**Backend (зеркало):** `backend/src/lib/clientCases.js` → `buildClientCasesFromDb()`, `serializeClientCase()`

**Входные данные:**
- `consultations[]` — сессии ИИ
- `requests[]` — заявки (`ServiceRequest`)
- `bookings[]` — записи на визит

**Алгоритм группировки:**
1. Каждая заявка → Case `kind: 'request'`, `id = serviceRequestId`
2. Консультации без заявки и не привязанные к request → Case `kind: 'draft'`, `id = consultationSessionId`
3. Booking привязывается к request через `booking.serviceRequest.id`
4. Сортировка по `lastActivityAt` desc

**Прогресс (4 стадии):**

| Стадия | `progressStage` | Условие |
|--------|-----------------|---------|
| Диагностика | `diagnosis` | Черновик консультации |
| Заявка | `request` | NEW / IN_PROGRESS |
| Запись | `booking` | Есть booking или status SCHEDULED |
| Готово | `done` | COMPLETED / CANCELLED |

**Типы:** `frontend/src/features/client-cases/types.ts`  
**Тесты:** `frontend/src/features/client-cases/buildClientCases.test.ts`, `backend/tests/unit/clientCases.test.js`

#### B2. Страница списка обращений

**Файл:** `frontend/src/pages/dashboards/client/ClientCasesPage.tsx`  
**Маршрут:** `/dashboard/client/cases`

**Вкладки (deep link):**

| Вкладка | `?tab=` | Фильтр |
|---------|---------|--------|
| Активные | `active` (default) | request, не COMPLETED/CANCELLED |
| Архив | `archive` | request, COMPLETED или CANCELLED |
| Черновики | `drafts` | kind === 'draft' |

**Toolbar:** поиск `?q=` по марке, модели, симптомам (`filterCasesByQuery`)

**Данные:** параллельно `GET /consultations`, `GET /service-requests`, `GET /bookings` → `buildClientCases()`

**Карточка:** `frontend/src/components/client/CaseCard.tsx`
- Заголовок: марка/модель
- Симптом (truncate 80)
- Мини-пайплайн: 4 точки (diagnosis → request → booking → done)
- `UrgencyBadge` при critical
- `StatusBadge`
- Клик → `/dashboard/client/cases/:caseId`

#### B3. Детали обращения

**Файл:** `frontend/src/pages/dashboards/client/ClientCaseDetailPage.tsx`  
**Маршрут:** `/dashboard/client/cases/:caseId`

**caseId** может быть:
- `serviceRequestId` — если это обращение
- `consultationSessionId` — если черновик диагностики

**IA (Next Action First):**
- Единый hero: авто · № · симптомы + встроенный `CaseNextStep` (tone/icon)
- Без `PageHeader` / `StatusPipeline` на деталях
- Тон страницы (`data-tone`) красит hero, вкладки и sticky

**Вкладки (`?tab=`):** сегменты с иконками

| tab | Лейбл | Содержимое |
|-----|-------|------------|
| `progress` | Обзор | fact-chips + `CaseTimeline` + teaser визита |
| `diagnosis` | Диагностика | `DiagnosticSummary` |
| `messages` | Сообщения | Bubble-chat с менеджером |
| `booking` | Визит | `CaseVisitPanel` (spotlight-карточка) |

**CaseTimeline** (`frontend/src/components/client/CaseTimeline.tsx`):
- 4 шага с иконками и connector: Диагностика → Ответ сервиса → Визит → Готово
- Состояния: `done` / `current` / `upcoming`

**CaseNextStep** (`frontend/src/components/client/CaseNextStep.tsx` + `resolveCaseNextStep.ts`):
- State machine + `tone` / `icon` по draft / request.status / наличию визита

**Sticky footer (mobile):** те же CTA, что в `CaseNextStep`

**Сообщения:**
- `GET/POST /service-requests/:id/messages`
- Bubble UI: `.message-bubble.is-client` / `.is-staff`
- Блокировка при `COMPLETED` / `CANCELLED`

**Визит из обращения:** `prefillBookingFromConsultation()` → `/booking` с `serviceRequestId`

#### B4. Роутинг и legacy-редиректы

**Файл:** `frontend/src/app/router.tsx`

| Старый маршрут | Новый |
|----------------|-------|
| `client/requests` | redirect → `/dashboard/client/cases` |
| `client/requests/:requestId` | redirect → `/dashboard/client/cases/:requestId` |
| `client/consultations` | redirect → `/dashboard/client/cases?tab=drafts` |

**Новые маршруты:**
- `client/cases` → `ClientCasesPage`
- `client/cases/:caseId` → `ClientCaseDetailPage`

#### B5. Навигация

**Файл:** `frontend/src/config/dashboardNav.ts`

Было: «Заявки» + «Консультации» + «Записи»  
Стало: **«Мои обращения»** (`client-cases`) + «Записи» + «Профиль» + «ИИ-диагностика»

#### B6. Стили Case

**Файл:** `frontend/src/styles/main.css` (секция Client cases)
- `.case-card`, `.case-card-rail`, `.case-mini-pipeline`
- `.case-timeline`, `.message-thread-bubbles`, `.message-bubble`
- `.case-detail-sticky-actions`

#### B7. Статусы для клиента

**Файл:** `frontend/src/lib/clientStatusLabels.ts`
- `CLIENT_REQUEST_STATUS_LABELS` — заявки
- `CLIENT_BOOKING_STATUS_LABELS` — записи
- `clientRequestStatusLabel()`, `clientBookingStatusLabel()`

---

### Фаза C — «Главная с умом»

> Главная отвечает «что делать прямо сейчас» без лишних кликов.

#### C1. Backend: агрегат для главной

**Endpoint:** `GET /api/users/me/summary`  
**Файлы:** `users.router.js`, `users.service.js` → `getMeSummary()`

**Один запрос вместо четырёх** на главной (раньше: profile + consultations + requests + bookings отдельно).

**Ответ:**
```json
{
  "profile": { "fullName": "Иван", "phone": "+79990000000" },
  "activeCasesCount": 2,
  "unreadMessagesCount": 0,
  "hasAnyHistory": true,
  "nextBooking": {
    "id": "uuid",
    "preferredAt": "2026-08-01T10:00:00.000Z",
    "status": "CONFIRMED"
  },
  "draftConsultation": {
    "id": "session-uuid",
    "make": "Toyota",
    "model": "Camry",
    "symptom": "Стук при торможении",
    "status": "IN_PROGRESS"
  },
  "recentActiveCases": [ /* до 5 ClientCase */ ]
}
```

**Логика `getMeSummary`:**
- Загружает consultations (50), requests (50), bookings (30) клиента
- `buildClientCasesFromDb()` — та же логика, что на фронте
- `activeCases` = request Cases не COMPLETED/CANCELLED
- `draftConsultation` = первый draft Case
- `nextBooking` = ближайшая неотменённая запись с `preferredAt >= now - 1h`
- `hasAnyHistory` = cases.length > 0

**Тесты:** `backend/tests/integration/users-summary.test.js`

#### C2. Умный hero

**Файл:** `frontend/src/features/client-cases/resolveClientHero.ts`

**Приоритет состояний (сверху вниз):**

| # | Условие | Заголовок | CTA |
|---|---------|-----------|-----|
| 1 | Есть `draftConsultation` | «Продолжить: {марка} — {симптом}» | `/consult` + sessionId в storage |
| 2 | Первый active case `status === NEW` | «Менеджер рассматривает обращение» | `/cases/:id?tab=messages` |
| 3 | Есть `nextBooking` | «Визит: {дата}» | `/bookings/:id` |
| 4 | `activeCasesCount > 0` | «Активных обращений: N» | `/cases/:id` |
| 5 | `!hasAnyHistory` | «Расскажите о проблеме…» (новичок) | `/consult` |
| 6 | Fallback | «Всё в порядке!» | `/consult` + secondary «Записаться» |

**Тесты:** `frontend/src/features/client-cases/resolveClientHero.test.ts`

#### C3. Переработанная главная

**Файл:** `frontend/src/pages/dashboards/client/ClientOverviewPage.tsx`

**Блоки (сверху вниз):**
1. `DashboardWelcomeHero` — greeting + hero title/description + primary/secondary CTA
2. Баннер непрочитанных (Фаза E, если `unreadMessagesCount > 0`)
3. Empty state новичка (`hero.isNewcomer`) — карточка «Добро пожаловать»
4. **Лента «Активное»** — `.case-card-rail` с `CaseCard` (горизонтальный скролл)
5. **Быстрые действия** — 3 плитки: Диагностика / Запись / Каталог услуг
6. **Ближайший визит** — `DashboardRecordCard` + кнопка `.ics`
7. **«Как это работает»** — только если `!hasAnyHistory` (3 шага)

**Убрано:** метрики-счётчики 4×4

**API:** `getClientDashboardSummary()` в `frontend/src/api/dashboard.ts`

---

### Фаза D — «Записи как продукт»

> Запись — полноценная сущность, не строка в списке.

#### D1. Список записей (расширен)

**Файл:** `frontend/src/pages/dashboards/client/ClientBookingsPage.tsx`

**Вкладки (`?tab=`):**

| tab | Фильтр |
|-----|--------|
| `upcoming` | `preferredAt >= now - 1h`, status ≠ CANCELLED |
| `past` | прошедшие, status ≠ CANCELLED |
| `cancelled` | status === CANCELLED |

**Утилита:** `frontend/src/lib/bookingTabs.ts` → `parseBookingTab()`

**Карточки:** кликабельны → `/dashboard/client/bookings/:id`  
**Баннер после создания:** `?created={id}` → ссылка «Открыть детали»

#### D2. Детальная страница записи

**Файл:** `frontend/src/pages/dashboards/client/ClientBookingDetailPage.tsx`  
**Маршрут:** `/dashboard/client/bookings/:bookingId`

**Отображает:**
- Дата/время (полный формат)
- Статус (`clientBookingStatusLabel`)
- Адрес сервиса + ссылка на карту (`useProductConfig()`)
- Режим работы
- Комментарий клиента
- Связанное обращение → `/dashboard/client/cases/:serviceRequestId`

**Действия:**
- **Добавить в календарь (.ics)** — `buildBookingIcs()` + `downloadBookingIcs()`
- **Перенести** — prefill в `sessionStorage` → `/booking`
- **Отменить** — `PATCH /bookings/:id` `{ status: 'CANCELLED' }` (только upcoming, не cancelled)

#### D3. Wizard записи (4 шага)

**Файл:** `frontend/src/pages/public/BookingPage.tsx` (полная переработка)

| Шаг | UI | Валидация |
|-----|-----|-----------|
| 1. Когда | `datetime-local` | required |
| 2. Контакты | Guest: имя/телефон/email; Auth: показ профиля | имя+телефон для guest |
| 3. Детали | Комментарий + select обращения (auth) | — |
| 4. Подтверждение | Сводка + `ConsentCheckbox` | согласие ПДн |

**Навигация:** «Назад» / «Далее» / «Отправить заявку»  
**Индикатор:** `.booking-wizard-steps` (4 шага)

**После успеха:**
- Auth → `navigate('/dashboard/client/bookings/:id')`
- Guest → toast + CTA «Создайте аккаунт»

#### D4. Экспорт .ics

**Файл:** `frontend/src/lib/buildBookingIcs.ts`

- Генерирует VCALENDAR/VEVENT
- Поля: UID, DTSTART, DTEND (+1h), SUMMARY, LOCATION, DESCRIPTION
- `downloadBookingIcs()` — blob download

**Используется на:** детали записи, главная (кнопка `.ics` у ближайшего визита)

**Тесты:** `frontend/src/lib/buildBookingIcs.test.ts`

#### D5. Backend: GET и PATCH записи

**Файлы:** `bookings.service.js`, `bookings.router.js`

| Метод | Путь | Роль | Действие |
|-------|------|------|----------|
| `GET` | `/api/bookings/:bookingId` | CLIENT (свои), MANAGER, ADMIN | Детали записи |
| `PATCH` | `/api/bookings/:bookingId` | CLIENT | Только `{ status: 'CANCELLED' }` |
| `PATCH` | `/api/bookings/:bookingId` | MANAGER, ADMIN | Полный patch (status, preferredAt, notes, guest*) |

`patchClientBooking()` — проверяет `clientId === user.id`, идемпотентен для уже отменённых.

**Тесты (расширены):** `bookings-client.test.js` — GET, PATCH cancel, reject invalid patch

#### D6. API frontend

**Файл:** `frontend/src/api/dashboard.ts`
```ts
getBooking(bookingId)
cancelBooking(bookingId)  // PATCH { status: 'CANCELLED' }
```

---

### Фаза E — «Полировка»

#### E1. Мобильная bottom navigation

**Файл:** `frontend/src/components/client/ClientBottomNav.tsx`  
**Показ:** `@media (max-width: 900px)` в `DashboardShell`

```
[Главная] [Обращения●] [Записи] [Ещё]
```

- **Главная** → `/dashboard/client`
- **Обращения** → `/dashboard/client/cases` + dot/badge при `unreadCases > 0`
- **Записи** → `/dashboard/client/bookings`
- **Ещё** → выпадающее меню:
  - Профиль
  - ИИ-диагностика
  - Каталог услуг
  - На сайт
  - Выйти

**Интеграция:** `DashboardShell.tsx` — класс `.has-client-bottom-nav`, padding-bottom у контента

#### E2. Онбординг (первый вход)

**Файл:** `frontend/src/components/client/ClientOnboarding.tsx`

**3 шага overlay:**
1. Мои обращения — вся история в одном месте
2. ИИ-диагностика — чат с ассистентом
3. Записи в сервис — календарь и статус

**Кнопки:** Пропустить / Далее / Не показывать снова  
**Storage:** `STORAGE_KEYS.clientOnboardingDone` = `car_service_client_onboarding_done`

**Показ:** при первом заходе в кабинет CLIENT, пока ключ не установлен (`DashboardShell`)

#### E3. Профиль с вкладками

**Файл:** `frontend/src/pages/dashboards/ProfilePage.tsx` (переписан)  
**Утилита:** `frontend/src/lib/profileTabs.ts`

| Вкладка | `?tab=` | Реализация |
|---------|---------|------------|
| Контакты | `contacts` | Форма: имя, телефон, email (readonly). `PATCH /users/me` |
| Мои автомобили | `vehicles` | `GET /consultations` → дедуп по make/model/year. Ссылка на cases с `?q=` |
| Уведомления | `notifications` | 3 toggle: напоминания, сообщения, акции. `localStorage` |
| Безопасность | `security` | Placeholder: «смена пароля в следующем обновлении» |

**Для CLIENT убрано:** блок «Роль: Клиент», UUID аккаунта  
**Для MANAGER/ADMIN:** остаётся только вкладка «Контакты»

**Storage уведомлений:** `STORAGE_KEYS.clientNotificationPrefs`

#### E4. Непрочитанные сообщения (backend + UI)

**Миграция:** `backend/prisma/migrations/20260730220000_client_messages_read_at/`  
**Поле:** `ServiceRequest.clientMessagesReadAt` (DateTime?)

**Логика подсчёта** (`requestMessages.service.js` → `countUnreadMessagesForClient`):
- Для каждой заявки клиента
- Считать `RequestFollowUpMessage` где `author.role !== 'CLIENT'`
- Если `clientMessagesReadAt` задан → только `createdAt > clientMessagesReadAt`
- Если null → все сообщения staff считаются непрочитанными

**Mark as read:** при `GET /service-requests/:id/messages` клиентом → `clientMessagesReadAt = now()`

**UI бейджи:**
- Сайдбар: `badges['client-cases']` в `DashboardSidebar`
- Bottom nav: dot на «Обращения»
- Главная: баннер «У вас N новое сообщение от менеджера»

**Summary:** `unreadMessagesCount` в `GET /users/me/summary` — реальное значение (не заглушка 0)

#### E5. Шаблоны быстрых вопросов

**Файл:** `frontend/src/lib/clientMessageTemplates.ts`

| ID | Кнопка | Текст |
|----|--------|-------|
| `when-ready` | Когда будет готово? | Здравствуйте! Подскажите, когда ориентировочно будет готов автомобиль? |
| `cost` | Сколько стоит? | …предварительную стоимость работ и запчастей? |
| `today` | Можно сегодня? | …принять автомобиль сегодня или в ближайшие дни? |

**UI:** `.message-template-chips` над textarea в `ClientCaseDetailPage` (вкладка messages)

#### E6. Доступность и shell

**Файл:** `frontend/src/components/layout/dashboard/DashboardShell.tsx`

- Skip link: `<a href="#dashboard-main" className="skip-link">`
- `id="dashboard-main"` на `.dashboard-shell-content`
- Загрузка summary + badges при каждой смене `location.pathname` в client-зоне
- `ClientOnboarding` + `ClientBottomNav` рендерятся только для `role === CLIENT'`

**CSS a11y:**
- Touch targets ≥ 44px (bottom nav, template chips, profile toggles)
- `prefers-reduced-motion: reduce` для `.case-mini-pipeline-dot`

---

## Ментальная модель Case

```
Симптом → ИИ-диагностика → Заявка → Переписка → Запись → Ремонт завершён
```

**Case ID (MVP):** `serviceRequestId` если есть заявка, иначе `consultationSessionId`.

**Типы Case:**

```ts
type ClientCase = {
  id: string;
  kind: 'request' | 'draft';
  title: string;           // "BMW X5"
  symptoms: string;        // truncate 80
  progressStage: 'diagnosis' | 'request' | 'booking' | 'done';
  progressPercent: number; // 25 | 40 | 55 | 75 | 100
  progressLabel: string;   // "Заявка принята"
  serviceRequestId?: string;
  consultationSessionId?: string;
  bookingId?: string;
  bookingPreferredAt?: string;
  urgency?: string | null;
};
```

**Backlog P3:** явная таблица `ClientCase` в Prisma (сейчас — виртуальная группировка).

---

## Информационная архитектура

### Боковое меню (desktop)

| Пункт | Маршрут | id в nav |
|-------|---------|----------|
| Обзор | `/dashboard/client` | `client-home` |
| Мои обращения | `/dashboard/client/cases` | `client-cases` |
| Записи | `/dashboard/client/bookings` | `client-bookings` |
| Профиль | `/dashboard/client/profile` | `client-profile` |
| ИИ-диагностика | `/consult` | `client-consult` |

### Мобильная навигация

`ClientBottomNav` — фиксированная панель снизу, ≤900px.

### Legacy-редиректы (хранить ≥ 6 мес.)

| Старый URL | Новый URL |
|------------|-----------|
| `/dashboard/client/requests` | `/dashboard/client/cases` |
| `/dashboard/client/requests/:id` | `/dashboard/client/cases/:id` |
| `/dashboard/client/consultations` | `/dashboard/client/cases?tab=drafts` |

### Карта маршрутов

```
Публичный сайт
├── /                         лендинг
├── /consult                  ИИ-диагностика
├── /booking                  запись (wizard 4 шага)
├── /services, /works, /gallery, /about
└── /login, /register

Кабинет CLIENT
├── /dashboard/client                              Главная
├── /dashboard/client/cases                        Мои обращения
│   └── ?tab=active|archive|drafts&q=
├── /dashboard/client/cases/:caseId                Детали обращения
│   └── ?tab=progress|diagnosis|messages|booking
├── /dashboard/client/bookings                     Записи
│   └── ?tab=upcoming|past|cancelled&created=
├── /dashboard/client/bookings/:bookingId          Детали записи
├── /dashboard/client/profile                      Профиль
│   └── ?tab=contacts|vehicles|notifications|security
│
│   Legacy redirects (см. выше)
│
├── /consult, /booking (из сайдбара)
└── Mobile: ClientBottomNav + ClientOnboarding
```

---

## Экраны — детальная спецификация

### 1. Главная `/dashboard/client` ✅

См. [Фаза C](#фаза-c--главная-с-умом).

### 2. Мои обращения `/dashboard/client/cases` ✅

См. [Фаза B](#фаза-b--обращения-вместо-разрозненности).

**Не сделано:** per-case бейдж «Новое сообщение» на `CaseCard` (есть только общий счётчик).

### 3. Детали обращения `/dashboard/client/cases/:caseId` ✅

См. [Фаза B](#фаза-b--обращения-вместо-разрозненности) + шаблоны [Фаза E](#фаза-e--полировка).

### 4. Записи `/dashboard/client/bookings` ✅

См. [Фаза D](#фаза-d--записи-как-продукт).

### 5. Детали записи `/dashboard/client/bookings/:bookingId` ✅

См. [Фаза D](#фаза-d--записи-как-продукт).

### 6. Профиль `/dashboard/client/profile` ✅

См. [Фаза E](#фаза-e--полировка). Security — placeholder.

### 7. ИИ-диагностика `/consult` — частично

| Задача | Статус |
|--------|--------|
| Claim после login/register | ✅ Фаза A |
| Мобильные вкладки «Описать / Результат» | ❌ backlog |
| Auth-баннер «Сохранено в кабинет» | ❌ backlog |
| Prefill имени/телефона из профиля | ❌ backlog |
| Чеклист полей в шапке | ❌ backlog |
| CTA-приоритет на результате | ❌ backlog |

### 8. Запись `/booking` ✅

См. [Фаза D](#фаза-d--записи-как-продукт).

---

## API и backend

### Endpoints (новые / изменённые для CLIENT)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/users/me/summary` | Агрегат главной |
| `GET` | `/api/bookings/:id` | Детали записи |
| `PATCH` | `/api/bookings/:id` | CLIENT: cancel; staff: full patch |
| `POST` | `/api/bookings` | Создание записи (CLIENT) |
| `POST` | `/api/bookings/guest` | Создание записи (гость) |
| `POST` | `/api/consultations/:id/claim` | Привязка гостевой сессии |
| `GET` | `/api/consultations` | + make, model, symptoms в list |
| `GET` | `/api/service-requests/:id/messages` | + auto mark read для CLIENT |

### Prisma (изменения)

```prisma
model ServiceRequest {
  // ...
  clientMessagesReadAt  DateTime?  @map("client_messages_read_at")
}
```

**Миграция:** `20260730220000_client_messages_read_at`

### localStorage / sessionStorage

| Ключ | Константа | Назначение |
|------|-----------|------------|
| `car_service_consult_session_id` | `consultSessionId` | ID сессии для продолжения / claim |
| `car_service_consult_guest_token` | `consultGuestToken` | Токен гостевой сессии |
| `car_service_booking_prefill` | `bookingPrefill` | Prefill формы записи |
| `car_service_client_onboarding_done` | `clientOnboardingDone` | Онбординг пройден |
| `car_service_client_notification_prefs` | `clientNotificationPrefs` | Toggles уведомлений |

---

## Сквозные UX-паттерны

### Язык статусов ✅

`frontend/src/lib/clientStatusLabels.ts`

| Backend | UI |
|---------|-----|
| `NEW` | Принята, ждёт менеджера |
| `IN_PROGRESS` | В работе у мастера |
| `SCHEDULED` | Запись назначена |
| `COMPLETED` | Ремонт завершён |
| `CANCELLED` | Отменена |
| `PENDING` (booking) | Ожидает подтверждения |
| `CONFIRMED` (booking) | Подтверждена |

### Уведомления и бейджи ✅

- Сайдбар + bottom nav: счётчик на «Обращения»
- Главная: баннер непрочитанных
- ❌ Per-case бейдж на `CaseCard` — backlog

### Доступность

- [x] Skip link
- [x] Touch targets ≥ 44px (mobile)
- [x] `prefers-reduced-motion`
- [x] `role="tablist"`, `aria-selected` на Tabs
- [ ] Формальный аудит контраста — не проводился

### Онбординг ✅

3 шага, `ClientOnboarding.tsx`, dismiss в localStorage.

---

## Инвентарь файлов

### Frontend — созданные с нуля

| Файл | Назначение |
|------|------------|
| `features/client-cases/buildClientCases.ts` | Группировка Case |
| `features/client-cases/types.ts` | Типы Case |
| `features/client-cases/resolveClientHero.ts` | Логика hero главной |
| `features/consultations/claimGuestSession.ts` | Claim гостевой сессии |
| `pages/dashboards/client/ClientCasesPage.tsx` | Список обращений |
| `pages/dashboards/client/ClientCaseDetailPage.tsx` | Детали обращения |
| `pages/dashboards/client/ClientBookingDetailPage.tsx` | Детали записи |
| `components/client/CaseCard.tsx` | Карточка Case |
| `components/client/CaseTimeline.tsx` | Таймлайн хода дела |
| `components/client/ClientBottomNav.tsx` | Mobile bottom bar |
| `components/client/ClientOnboarding.tsx` | Overlay онбординг |
| `lib/clientStatusLabels.ts` | Человеческие статусы |
| `lib/consultationLabels.ts` | Названия консультаций |
| `lib/buildBookingIcs.ts` | Генерация .ics |
| `lib/bookingTabs.ts` | Парсер tab записей |
| `lib/profileTabs.ts` | Парсер tab профиля |
| `lib/clientMessageTemplates.ts` | Шаблоны вопросов |

### Frontend — существенно изменённые

| Файл | Что изменилось |
|------|----------------|
| `ClientOverviewPage.tsx` | Полная переработка: hero, лента, summary API |
| `ClientBookingsPage.tsx` | 3 вкладки, кликабельные карточки, ?tab= |
| `ProfilePage.tsx` | Вкладки, vehicles, notifications, без UUID |
| `BookingPage.tsx` | Wizard 4 шага, auth redirect на detail |
| `LoginPage.tsx` / `RegisterPage.tsx` | Claim сессии |
| `DashboardShell.tsx` | Skip link, bottom nav, onboarding, badges |
| `dashboardNav.ts` | Новая IA навигации |
| `router.tsx` | Новые маршруты + legacy redirects |
| `api/dashboard.ts` | summary, getBooking, cancelBooking |
| `styles/main.css` | case-*, booking-*, client-bottom-nav, onboarding |

### Backend — созданные / изменённые

| Файл | Что сделано |
|------|-------------|
| `lib/clientCases.js` | Зеркало buildClientCases для summary |
| `users.service.js` | `getMeSummary()` |
| `users.router.js` | `GET /me/summary` |
| `bookings.service.js` | `getBooking()`, `patchClientBooking()` |
| `bookings.router.js` | `GET/:id`, role-based `PATCH` |
| `requestMessages.service.js` | `countUnreadMessagesForClient()`, mark read |
| `consultations.router.js` | make/model/symptoms в list |
| `schema.prisma` | `clientMessagesReadAt` |
| `migrations/20260730220000_client_messages_read_at/` | SQL миграция |

### Устаревшие (не в роутере, можно удалить после 6 мес.)

- `ClientRequestsPage.tsx`
- `ClientConsultationsPage.tsx`
- `ClientRequestDetailPage.tsx`

---

## Тесты

### Frontend (vitest)

| Файл | Покрывает |
|------|-----------|
| `BookingPage.test.tsx` | Guest wizard, auth redirect на detail |
| `claimGuestSession.test.ts` | Claim flow |
| `consultationLabels.test.ts` | formatConsultationTitle |
| `buildClientCases.test.ts` | Группировка, booking link |
| `resolveClientHero.test.ts` | 5 состояний hero |
| `buildBookingIcs.test.ts` | VCALENDAR format |
| `profileTabs.test.ts` | parseProfileTab |

### Backend (jest)

| Файл | Покрывает |
|------|-----------|
| `bookings-client.test.js` | POST, GET list, GET/:id, PATCH cancel |
| `users-summary.test.js` | GET /me/summary структура |
| `clientCases.test.js` | buildClientCasesFromDb unit |

---

## Backlog

### Не вошло в MVP

| Задача | Приоритет | Примечание |
|--------|-----------|------------|
| Polish `/consult` (вкладки, чеклист, CTA) | P1 UX | Секция 7 документа |
| Модель `ClientCase` в Prisma | P3 | Явная сущность вместо виртуальной |
| Per-case бейдж непрочитанного на CaseCard | P2 | Сейчас только общий счётчик |
| Смена пароля в профиле | P2 | Нужен API |
| Push-уведомления | P3 | Toggles пока в localStorage |
| Удаление legacy-страниц | — | После 6 мес. редиректов |
| Формальный a11y-аудит контраста | — | |

### Деплой

После изменений frontend/backend:
```bash
cd /home/demo/car-service-ai-assistant
sudo docker compose --env-file .env.proxmox up -d --build
```

---

## Журнал прогресса

| Дата | Что сделано | Фаза |
|------|-------------|------|
| 2026-07-30 | Создан документ, аудит CLIENT UX, диагноз разрывов | — |
| 2026-07-30 | Auth booking, guest booking, claim консультации, профиль в nav, consultation labels, тесты | **A** |
| 2026-07-30 | buildClientCases, ClientCasesPage, ClientCaseDetailPage, CaseTimeline, CaseCard, роуты, redirects, clientStatusLabels, стили | **B** |
| 2026-07-30 | GET /me/summary, resolveClientHero, переработка ClientOverviewPage, убраны 4×4 метрики | **C** |
| 2026-07-30 | ClientBookingDetailPage, wizard /booking, buildBookingIcs, вкладка «Отменённые», GET/PATCH bookings, тесты | **D** |
| 2026-07-30 | ClientBottomNav, ClientOnboarding, ProfilePage tabs, unread messages (миграция + API), шаблоны, skip link, DashboardShell | **E** |
| 2026-07-30 | Полная синхронизация документа с реализацией A–E | — |

---

## Заметки и решения

- **Case ID:** `serviceRequestId` приоритетнее `consultationSessionId`
- **Summary vs frontend:** логика Case дублирована в `clientCases.js` (backend) и `buildClientCases.ts` (frontend) — при изменениях синхронизировать оба
- **Unread:** mark-read на GET messages — простое MVP; альтернатива — отдельный `POST .../mark-read`
- **Онбординг:** показывается до первого dismiss; не привязан к `hasAnyHistory` (может показаться и returning user без dismiss)
- **Bottom nav:** скрывается на desktop (>900px), сайдбар остаётся основной навигацией
