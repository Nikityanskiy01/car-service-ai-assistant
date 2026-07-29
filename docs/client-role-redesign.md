# Переосмысление роли CLIENT — рабочий документ

> Отмечай прогресс галочками `[x]`.  
> Связанные материалы: [ai-improvement-roadmap.md](./ai-improvement-roadmap.md), [architecture.md](./architecture.md).

**Статус:** Фазы A–E реализованы (MVP кабинета CLIENT готов)  
**Последнее обновление:** 2026-07-30

---

## Цель

Не «ещё один кабинет», а **личный центр обслуживания автомобиля**: клиент видит одну историю от симптома до визита в сервис, а не разрозненные сущности БД.

**Принцип каждого экрана:** отвечать на вопрос *«что мне делать дальше?»*

---

## Итог реализации (кратко)

| Фаза | Название | Статус |
|------|----------|--------|
| A | Починить доверие | ✅ |
| B | Обращения вместо разрозненности | ✅ |
| C | Главная с умом | ✅ |
| D | Записи как продукт | ✅ |
| E | Полировка | ✅ |

**Не вошло в MVP (backlog):** polish `/consult`, модель `ClientCase` в Prisma (P3), бейдж непрочитанного на каждой карточке Case, смена пароля в профиле.

---

## Диагноз — что было и что исправлено

### Было сломано → исправлено

| Проблема (было) | Решение | Фаза |
|-------------------|---------|------|
| `/booking` всегда `POST /bookings/guest` | Auth CLIENT → `POST /bookings`, guest → `POST /bookings/guest` | A |
| `POST /consultations/:id/claim` не вызывался | Claim после login/register из `sessionStorage` | A |
| Консультации: `Сессия A1B2C3D4` | `{make} {model} — {symptom}` в списках и Cases | A |
| Записи без детальной страницы | `ClientBookingDetailPage`, cancel, .ics | D |
| Профиль только в UserMenu | Пункт «Профиль» в сайдбаре + вкладки | A, E |
| «Заявки / Консультации / Записи» — три сущности | Один экран «Мои обращения» (Case) | B |
| Главная — счётчики 4×4 без смысла | Умный hero + лента активных Cases | C |
| `unreadMessagesCount` всегда 0 | `clientMessagesReadAt` + подсчёт в summary | E |

### Что уже работало до редизайна

- [x] Пайплайн: консультация → заявка → запись
- [x] StatusPipeline, переписка, PDF, диагноз в заявке
- [x] ИИ-чат: фото, OBD, стриминг, этапы анализа

---

## Новая ментальная модель: «Дело об автомобиле» (Case)

Центральная сущность — **Case (обращение)**. Один Case объединяет:

- консультацию(и) ИИ
- заявку менеджеру
- переписку
- запись на визит
- итоговый статус

```
Симптом → ИИ-диагностика → Заявка → Переписка → Запись → Ремонт завершён
```

**Реализовано (MVP):** Case = виртуальная группировка на фронте и в `GET /users/me/summary` по `consultationSessionId` / `serviceRequestId` / `bookingId`.  
**Файлы:** `frontend/src/features/client-cases/buildClientCases.ts`, `backend/src/lib/clientCases.js`

**Backlog (P3):** явная модель `ClientCase` в Prisma.

**Case ID на MVP:** `serviceRequestId` если есть, иначе `consultationSessionId`.

---

## Информационная архитектура

### Боковое меню — реализовано

| # | Пункт | Маршрут | Статус |
|---|-------|---------|--------|
| 1 | **Главная** | `/dashboard/client` | ✅ |
| 2 | **Мои обращения** | `/dashboard/client/cases` | ✅ |
| 3 | **Записи** | `/dashboard/client/bookings` | ✅ |
| 4 | **ИИ-диагностика** | `/consult` | ✅ |
| 5 | **Профиль** | `/dashboard/client/profile` | ✅ |

Группа «Действия» убрана. Конфиг: `frontend/src/config/dashboardNav.ts`.

### Мобильная навигация — реализовано

```
[Главная] [Обращения] [Записи] [Ещё]
```

«Ещё» → профиль, диагностика, каталог услуг, на сайт, выход.  
**Файл:** `frontend/src/components/client/ClientBottomNav.tsx` (≤900px).

### Legacy-редиректы — реализовано

| Старый URL | Новый URL |
|------------|-----------|
| `/dashboard/client/requests` | `/dashboard/client/cases` |
| `/dashboard/client/requests/:id` | `/dashboard/client/cases/:id` |
| `/dashboard/client/consultations` | `/dashboard/client/cases?tab=drafts` |

**Файл:** `frontend/src/app/router.tsx`

---

## Страницы — статус реализации

### 1. Главная — `/dashboard/client`

**Файл:** `frontend/src/pages/dashboards/client/ClientOverviewPage.tsx`

| Блок | Статус | Примечание |
|------|--------|------------|
| A. Умный hero | ✅ | `resolveClientHero.ts` — 5 состояний + CTA |
| B. Лента «Активное» | ✅ | `CaseCard` в `.case-card-rail` |
| C. Ближайший визит | ✅ | Карточка + кнопка `.ics` |
| D. Быстрые действия | ✅ | Диагностика / Запись / Каталог |
| E. «Как это работает» | ✅ | Только если `!hasAnyHistory` |
| Убраны метрики 4×4 | ✅ | |
| Empty state новичка | ✅ | Hero + блок onboarding |
| Баннер непрочитанных | ✅ | `unreadMessagesCount` из summary |

**Данные:** один запрос `GET /api/users/me/summary`.

---

### 2. Мои обращения — `/dashboard/client/cases`

**Файл:** `frontend/src/pages/dashboards/client/ClientCasesPage.tsx`

| Функция | Статус |
|---------|--------|
| Вкладки `?tab=active\|archive\|drafts` | ✅ |
| Поиск по симптомам / авто | ✅ |
| Карточка Case (марка, симптом, пайплайн, дата) | ✅ |
| Empty states по вкладкам | ✅ |
| `buildClientCases.ts` | ✅ |

**Не сделано:** бейдж «Новое сообщение» на отдельной карточке Case (есть только общий счётчик в навигации).

---

### 3. Детали обращения — `/dashboard/client/cases/:caseId`

**Файл:** `frontend/src/pages/dashboards/client/ClientCaseDetailPage.tsx`

| Вкладка | Статус |
|---------|--------|
| `progress` — StatusPipeline + CaseTimeline | ✅ |
| `diagnosis` — DiagnosticSummary | ✅ |
| `messages` — bubble-chat | ✅ |
| `booking` — запись или CTA | ✅ |
| Deep link `?tab=` | ✅ |
| Sticky footer (mobile) | ✅ |
| Шаблоны быстрых вопросов | ✅ | `clientMessageTemplates.ts` |
| Блокировка ввода при COMPLETED/CANCELLED | ✅ |
| Прочтение переписки → сброс unread | ✅ | auto при GET messages |

**Компоненты:** `CaseTimeline.tsx`, `CaseCard.tsx`.

---

### 4. Записи — `/dashboard/client/bookings`

**Файл:** `frontend/src/pages/dashboards/client/ClientBookingsPage.tsx`

| Функция | Статус |
|---------|--------|
| Вкладки: Предстоящие / Прошедшие / Отменённые | ✅ |
| Deep link `?tab=upcoming\|past\|cancelled` | ✅ |
| Кликабельные карточки → детали | ✅ |

---

### 5. Детали записи — `/dashboard/client/bookings/:bookingId`

**Файл:** `frontend/src/pages/dashboards/client/ClientBookingDetailPage.tsx`

| Функция | Статус |
|---------|--------|
| Дата, статус, комментарий | ✅ |
| Ссылка на связанное обращение | ✅ |
| Адрес из `productConfig` / CMS | ✅ |
| «Добавить в календарь» (.ics) | ✅ | `buildBookingIcs.ts` |
| «Отменить» (CLIENT) | ✅ | `PATCH /bookings/:id` |
| «Перенести» | ✅ | редирект на `/booking` с prefill |

**API:** `GET /api/bookings/:id`, `PATCH /api/bookings/:id` (CLIENT — только `CANCELLED`).

---

### 6. Профиль — `/dashboard/client/profile`

**Файл:** `frontend/src/pages/dashboards/ProfilePage.tsx`

| Вкладка | Статус | Примечание |
|---------|--------|------------|
| `contacts` | ✅ | Имя, телефон, email |
| `vehicles` | ✅ | Агрегация из `/consultations`, ссылка на cases |
| `notifications` | ✅ | Toggles в `localStorage` (заглушка до push) |
| `security` | ⚠️ | Placeholder — смена пароля когда будет API |
| Убраны UUID и «Роль: Клиент» | ✅ | Для роли CLIENT |
| Deep link `?tab=` | ✅ | `profileTabs.ts` |

---

### 7. ИИ-диагностика — `/consult` — backlog

**Файл:** `frontend/src/pages/public/ConsultPage.tsx`

| Задача | Статус |
|--------|--------|
| Мобильные вкладки «Описать проблему» / «Результат» | [ ] |
| Auth: баннер «Сохранено в кабинет» | [ ] |
| Claim после login/register | ✅ | Фаза A |
| Prefill имени/телефона из профиля | [ ] |
| Чеклист полей в шапке | [ ] |
| CTA-приоритет на результате | [ ] |

---

### 8. Запись — `/booking` — реализовано

**Файл:** `frontend/src/pages/public/BookingPage.tsx`

| Шаг | Статус |
|-----|--------|
| 1. Когда | ✅ |
| 2. Контакты (guest / профиль auth) | ✅ |
| 3. Детали + привязка к обращению | ✅ |
| 4. Подтверждение + ПДн | ✅ |
| Auth → `POST /bookings` | ✅ |
| Guest → `POST /bookings/guest` | ✅ |
| После успеха (auth) → `/bookings/:id` | ✅ |
| После успеха (guest) → CTA регистрации | ✅ |

---

## Сквозные UX-паттерны

### Язык статусов — реализовано

`frontend/src/lib/clientStatusLabels.ts`

| Backend enum | UI для клиента |
|--------------|----------------|
| `NEW` | Принята, ждёт менеджера |
| `IN_PROGRESS` | В работе у мастера |
| `SCHEDULED` | Запись назначена |
| `COMPLETED` | Ремонт завершён |
| `CANCELLED` | Отменена |
| `PENDING` (booking) | Ожидает подтверждения |
| `CONFIRMED` (booking) | Подтверждена |

### Уведомления и бейджи — реализовано

- [x] Счётчик непрочитанных на «Обращения» в сайдбаре и bottom nav
- [x] На главной: «У вас N новое сообщение от менеджера»
- [ ] Бейдж на карточке Case (per-case) — backlog

### Доступность — частично

- [x] Touch targets ≥ 44px (bottom nav, шаблоны сообщений)
- [x] `prefers-reduced-motion` для пайплайна
- [x] Skip link «К основному содержимому» (`DashboardShell`)
- [x] Вкладки: `role="tablist"`, `aria-selected` (`Tabs.tsx`)
- [ ] Аудит контраста статусов — не проводился формально

### Онбординг — реализовано

- [x] 3 шага overlay: обращения → диагностика → записи
- [x] Пропустить / Далее / Не показывать снова
- **Файл:** `frontend/src/components/client/ClientOnboarding.tsx`
- **Ключ:** `localStorage` → `car_service_client_onboarding_done`

---

## Backend — задачи

| Приоритет | Задача | Файлы | Статус |
|-----------|--------|-------|--------|
| **P0** | Auth booking: `POST /bookings` для CLIENT | `bookings.router.js`, `BookingPage.tsx` | [x] |
| **P0** | Claim гостевой сессии после login/register | `LoginPage`, `RegisterPage`, `claimGuestSession.ts` | [x] |
| **P1** | `GET /consultations` + make/model/symptoms | `consultations.router.js` | [x] |
| **P1** | `GET /users/me/summary` | `users.service.js`, `clientCases.js` | [x] |
| **P2** | `GET /bookings/:id` | `bookings.router.js` | [x] |
| **P2** | `PATCH /bookings/:id` cancel для CLIENT | `bookings.service.js` | [x] |
| **P2** | Unread count для request messages | `requestMessages.service.js`, миграция `client_messages_read_at` | [x] |
| **P3** | Модель `ClientCase` в Prisma | `schema.prisma` | [ ] |

### `GET /users/me/summary` — фактический ответ

```json
{
  "profile": { "fullName": "...", "phone": "..." },
  "activeCasesCount": 2,
  "unreadMessagesCount": 1,
  "hasAnyHistory": true,
  "nextBooking": { "id": "...", "preferredAt": "...", "status": "CONFIRMED" },
  "draftConsultation": { "id": "...", "make": "Toyota", "model": "Camry", "symptom": "..." },
  "recentActiveCases": [ /* top 5 ClientCase */ ]
}
```

**Unread:** сообщения от staff (`role !== CLIENT`) после `ServiceRequest.clientMessagesReadAt`. При `GET /service-requests/:id/messages` клиентом — `clientMessagesReadAt` обновляется.

---

## Фазы внедрения — все выполнены

### Фаза A — «Починить доверие» ✅

- [x] `BookingPage`: auth → `POST /bookings`, guest → `POST /bookings/guest`
- [x] Claim консультации после login/register
- [x] Профиль в сайдбаре
- [x] Человеческие названия консультаций
- [x] Тесты: `BookingPage.test.tsx`, `claimGuestSession.test.ts`, `bookings-client.test.js`

### Фаза B — «Обращения вместо разрозненности» ✅

- [x] `buildClientCases.ts` + `types.ts` + тесты
- [x] `ClientCasesPage` + вкладки + поиск
- [x] `ClientCaseDetailPage` — 4 вкладки
- [x] `CaseTimeline.tsx`, `CaseCard.tsx`
- [x] Роуты + legacy redirects
- [x] `dashboardNav.ts` — один пункт «Мои обращения»

### Фаза C — «Главная с умом» ✅

- [x] `GET /users/me/summary` (backend + `users-summary.test.js`)
- [x] `resolveClientHero.ts` + тесты
- [x] Контекстный hero, лента Cases, empty state
- [x] Убраны метрики 4×4

### Фаза D — «Записи как продукт» ✅

- [x] `ClientBookingDetailPage.tsx`
- [x] Wizard на `/booking` (4 шага)
- [x] `buildBookingIcs.ts` + тест
- [x] Вкладка «Отменённые», deep link `?tab=`
- [x] `PATCH /bookings/:id` cancel для CLIENT

### Фаза E — «Полировка» ✅

- [x] `ClientBottomNav.tsx`
- [x] `ClientOnboarding.tsx`
- [x] Профиль: вкладки contacts / vehicles / notifications / security
- [x] Bubble-chat в переписке (было в B, доработано шаблонами)
- [x] Бейджи непрочитанных (sidebar, bottom nav, баннер на главной)
- [x] `clientMessageTemplates.ts` — быстрые вопросы в переписке

---

## Карта маршрутов (актуальная)

```
Публичный сайт
├── /                    лендинг
├── /consult             ИИ-диагностика
├── /booking             запись (wizard 4 шага)
├── /services, /works, /gallery, /about
└── /login, /register

Кабинет CLIENT
├── /dashboard/client                          Главная
├── /dashboard/client/cases                    Мои обращения
│   └── ?tab=active|archive|drafts
├── /dashboard/client/cases/:caseId            Детали обращения
│   └── ?tab=progress|diagnosis|messages|booking
├── /dashboard/client/bookings                 Записи
│   └── ?tab=upcoming|past|cancelled
├── /dashboard/client/bookings/:bookingId      Детали записи
├── /dashboard/client/profile                  Профиль
│   └── ?tab=contacts|vehicles|notifications|security
│
│   Legacy (redirect):
│   /dashboard/client/requests → /cases
│   /dashboard/client/requests/:id → /cases/:id
│   /dashboard/client/consultations → /cases?tab=drafts
│
├── /consult, /booking (из сайдбара)
└── Mobile: ClientBottomNav (≤900px)
```

---

## Файлы — чеклист (итог)

### Frontend — новые

- [x] `frontend/src/features/client-cases/buildClientCases.ts`
- [x] `frontend/src/features/client-cases/types.ts`
- [x] `frontend/src/features/client-cases/resolveClientHero.ts`
- [x] `frontend/src/pages/dashboards/client/ClientCasesPage.tsx`
- [x] `frontend/src/pages/dashboards/client/ClientCaseDetailPage.tsx`
- [x] `frontend/src/pages/dashboards/client/ClientBookingDetailPage.tsx`
- [x] `frontend/src/components/client/CaseTimeline.tsx`
- [x] `frontend/src/components/client/CaseCard.tsx`
- [x] `frontend/src/components/client/ClientBottomNav.tsx`
- [x] `frontend/src/components/client/ClientOnboarding.tsx`
- [x] `frontend/src/lib/clientStatusLabels.ts`
- [x] `frontend/src/lib/buildBookingIcs.ts`
- [x] `frontend/src/lib/bookingTabs.ts`
- [x] `frontend/src/lib/profileTabs.ts`
- [x] `frontend/src/lib/clientMessageTemplates.ts`
- [x] `frontend/src/features/consultations/claimGuestSession.ts`

### Frontend — изменённые

- [x] `frontend/src/config/dashboardNav.ts`
- [x] `frontend/src/app/router.tsx`
- [x] `frontend/src/pages/dashboards/client/ClientOverviewPage.tsx`
- [x] `frontend/src/pages/dashboards/client/ClientBookingsPage.tsx`
- [x] `frontend/src/pages/dashboards/ProfilePage.tsx`
- [x] `frontend/src/pages/public/BookingPage.tsx`
- [x] `frontend/src/pages/auth/LoginPage.tsx`
- [x] `frontend/src/pages/auth/RegisterPage.tsx`
- [x] `frontend/src/components/layout/dashboard/DashboardShell.tsx`
- [x] `frontend/src/api/dashboard.ts`
- [x] `frontend/src/styles/main.css` (cases, booking, client polish)
- [ ] `frontend/src/pages/public/ConsultPage.tsx` — backlog polish

### Backend — новые / изменённые

- [x] `backend/src/modules/users/users.router.js` — `GET /me/summary`
- [x] `backend/src/modules/users/users.service.js` — `getMeSummary`
- [x] `backend/src/lib/clientCases.js`
- [x] `backend/src/modules/consultations/consultations.router.js` — make/model/symptoms в list
- [x] `backend/src/modules/bookings/bookings.service.js` — `getBooking`, `patchClientBooking`
- [x] `backend/src/modules/bookings/bookings.router.js` — `GET/:id`, `PATCH` для CLIENT
- [x] `backend/src/modules/requestMessages/requestMessages.service.js` — unread + mark read
- [x] `backend/prisma/schema.prisma` — `clientMessagesReadAt`
- [x] `backend/prisma/migrations/20260730220000_client_messages_read_at/`

### Тесты

- [x] `frontend/src/pages/public/BookingPage.test.tsx`
- [x] `frontend/src/features/consultations/claimGuestSession.test.ts`
- [x] `frontend/src/lib/consultationLabels.test.ts`
- [x] `frontend/src/features/client-cases/buildClientCases.test.ts`
- [x] `frontend/src/features/client-cases/resolveClientHero.test.ts`
- [x] `frontend/src/lib/buildBookingIcs.test.ts`
- [x] `frontend/src/lib/profileTabs.test.ts`
- [x] `backend/tests/integration/bookings-client.test.js`
- [x] `backend/tests/integration/users-summary.test.js`
- [x] `backend/tests/unit/clientCases.test.js`

### Устаревшие страницы (не в роутере, можно удалить после стабилизации)

- `frontend/src/pages/dashboards/client/ClientRequestsPage.tsx`
- `frontend/src/pages/dashboards/client/ClientConsultationsPage.tsx`
- `frontend/src/pages/dashboards/client/ClientRequestDetailPage.tsx`

---

## Что сознательно НЕ делаем

| Идея | Почему |
|------|--------|
| Свободный чат с ИИ в кабинете | Размывает продукт; есть `/consult` |
| Админ-метрики в кабинете клиента | Не нужны (fallback rate LLM и т.д.) |
| 3D / hyperrealism в UI кабинета | Плохая a11y и performance |
| Отдельная вкладка «Консультации» | Слита в Cases |

---

## Журнал прогресса

| Дата | Что сделано | Фаза |
|------|-------------|------|
| 2026-07-30 | Создан документ, аудит CLIENT UX | — |
| 2026-07-30 | Auth booking, claim консультации, профиль в сайдбаре, labels | A |
| 2026-07-30 | Cases: группировка, список, детали, timeline, redirects | B |
| 2026-07-30 | Summary API, умный hero, лента Cases, empty state | C |
| 2026-07-30 | Деталь записи, wizard /booking, .ics, отмена CLIENT | D |
| 2026-07-30 | Bottom nav, онбординг, профиль-вкладки, unread, шаблоны | E |
| 2026-07-30 | Документ синхронизирован с фактической реализацией A–E | — |

---

## Заметки и решения

- **Следующий шаг (backlog):** polish `ConsultPage` (мобильные вкладки, чеклист, CTA на результате).
- **Следующий шаг (backend P3):** модель `ClientCase` в Prisma — когда понадобится кросс-девайс sync и отчёты.
- **Удаление legacy-страниц:** после 6 мес. редиректов можно убрать `ClientRequestsPage` и др.
- **Уведомления в профиле:** toggles в `localStorage`; push — отдельная задача.
- **Пересборка Docker:** после изменений frontend/backend — `sudo docker compose --env-file .env.proxmox up -d --build`.
