# Спецификация редизайна админ-панели

> Рабочий документ: отмечай прогресс галочками `[x]`.  
> Связанные материалы: [architecture.md](./architecture.md), [ai-improvement-roadmap.md](./ai-improvement-roadmap.md), [ONBOARDING.md](./ONBOARDING.md).

**Статус:** ✅ Фазы A–E завершены (2026-07-30) — админка production-ready для демо  
**Последнее обновление:** 2026-07-30  
**Демо:** `admin@example.local` / `Admin-Demo-2026!` → `/dashboard/admin`

> Краткий онбординг по новой админке: [ONBOARDING.md § Администратор](./ONBOARDING.md#администратор)  
> Демо-сценарий: [demo-defense.md § Администратор](./demo-defense.md#4-администратор-23-мин)

---

## Итог реализации (фазы A–E)

### Что получилось

Админ-панель из «менеджер + 4 read-only экрана» превратилась в **операционный пульт** с 7 зонами навигации, Status Strip, command palette и полным покрытием API для ИИ, CMS, интеграций и аналитики.

| Зона | URL | Страница / компонент | Статус |
|------|-----|----------------------|--------|
| **Пульт** | `/dashboard/admin` | `AdminOverviewPage` — bento KPI, Action Inbox P0–P2 | ✅ |
| **Аналитика** | `/dashboard/admin/analytics` | 5 вкладок: overview, funnel, ai-quality, managers, export | ✅ |
| **Операции → Заявки** | `/operations/requests` | `ManagerRequestsPage` (adminZone) — таблица, канбан, bulk, CRM | ✅ |
| **Операции → Записи** | `/operations/bookings` | `ManagerCalendarPage` (adminZone) — календарь, capacity, audit drawer | ✅ |
| **Операции → Клиенты** | `/operations/clients` | `ManagerClientsPage` (adminZone) — досье + timeline | ✅ |
| **Операции → Обращения** | `/operations/contacts` | `ManagerContactsPage` (adminZone) | ✅ |
| **Команда → Пользователи** | `/team/users` | `AdminUsersPage` — роли, block/unblock | ✅ |
| **Команда → Активность** | `/team/activity` | `AdminTeamActivityPage` — лента + heatmap | ✅ |
| **ИИ → Статус** | `/ai/status` | `AdminAiStatusPage` — LLM, probe, eval badge | ✅ |
| **ИИ → Сценарии** | `/ai/scenarios` | `AdminAiScenariosPage` — CRUD сценариев/вопросов/подсказок | ✅ |
| **ИИ → Справочники** | `/ai/reference` | `AdminAiReferencePage` — категории, materials | ✅ |
| **ИИ → Память** | `/ai/memory` | `AdminAiMemoryPage` — stats, search, backfill | ✅ |
| **ИИ → Feedback** | `/ai/feedback` | `AdminAiFeedbackPage` — метрики и таблица | ✅ |
| **Сайт → Контент** | `/site/items` | `AdminSiteItemsPage` — CRUD + reorder услуг/работ/галереи | ✅ |
| **Сайт → Блоки** | `/site/blocks` | `AdminSiteBlocksPage` — CRUD, версии, rollback | ✅ |
| **Сайт → Оформление** | `/site/appearance` | `AdminSiteAppearancePage` — white-label в DB | ✅ |
| **Сайт → Юр. данные** | `/site/legal` | `AdminSiteLegalPage` — реквизиты оператора | ✅ |
| **Интеграции** | `/integrations` | `AdminIntegrationsPage` + detail + jobs + **conflicts inbox** | ✅ |
| **Безопасность** | `/security/audit` | `AdminAuditPage` v2 — фильтры, labels, CSV export | ✅ |

### Shell и UX (глобально)

| Фича | Файл | Статус |
|------|------|--------|
| Status Strip (ИИ · CRM · Очередь · Заявки) | `AdminStatusStrip.tsx`, `useAdminSystemStatus.ts` | ✅ |
| Breadcrumbs | `AdminBreadcrumbs.tsx`, `adminRoutes.ts` | ✅ |
| Command palette `Ctrl+K` | `AdminCommandPalette.tsx`, `useAdminCommandPalette.ts` | ✅ |
| Dark mode (авто при первом входе в админку) | `DashboardShell.tsx` + `ThemeProvider` | ✅ |
| Permission hooks | `adminPermissions.ts`, `useAdminPermission.ts` | ✅ |
| Legacy URL redirects | `router.tsx` | ✅ |
| White-label на публичном сайте | `ProductConfigProvider.tsx` → `GET /content/site-settings` | ✅ |

### Backend API (новое / расширенное)

| Endpoint | Назначение | Фаза |
|----------|------------|------|
| `GET/PATCH /admin/site-settings` | White-label в `SiteSettings` (Prisma) | C |
| `GET /content/site-settings` | Публичный runtime config | C |
| `GET/POST /admin/ai/memory/*` | stats, search, backfill | B |
| `GET /admin/llm-eval` | Rule-based eval набора промптов (38 сценариев) | E |
| `GET /admin/integration-conflicts` | Глобальный inbox конфликтов CRM | D |
| `GET /analytics/kpi?days=N` | KPI с периодом + funnel steps | D |
| `GET /bookings/:id/audit` | Audit log записи (только ADMIN) | D |

### E2E

- `tests/e2e/admin-nav-smoke.spec.js` — обход всех зон + `Ctrl+K`

### Осознанно отложено (фаза 2 / backlog)

- Отдельные admin-only страницы операций (сейчас reuse менеджерских с `adminZone`)
- Глобальный date range picker, sparklines, сравнение с прошлым периодом в аналитике
- Upload логотипа, WCAG-check цветов, iframe live preview CMS
- Гранулярные роли (`admin.*` permissions в БД)
- `/security/sessions`, invite flow, soft delete заявок, A/B промптов
- Старые файлы `AdminCmsPage.tsx`, `AdminAppearancePage.tsx` — не используются в роутере (можно удалить)

---

## Цель

Переосмыслить админ-панель с нуля: не «менеджер + пара read-only экранов», а **операционный пульт** автосервиса — сервис, ИИ, сайт, интеграции и команда в одном месте.

**Принципы:**

1. **Ops-first** — статусы (ИИ, CRM, очередь) всегда на виду.
2. **Один объект — много входов** — заявка доступна из Операций, Аналитики, ИИ-студии и Интеграций.
3. **API → UI parity** — всё из `admin.router.js` получает экран.
4. **Dense, но сканируемо** — плотная сетка KPI, bullet charts, funnel.
5. **Бренд** — оранжевый `#EA580C` из `productConfig`, не generic purple.
6. **Deep links** — фильтры и вкладки в URL (`?period=30&tab=ai-quality`).

---

## Диагноз: что было и что исправлено

| Было | Стало |
|------|-------|
| Админка = менеджер + 4 read-only раздела | 7 зон, 20+ экранов, операционный пульт |
| API справочников и CMS без UI | ИИ-студия + Сайт и бренд с полным CRUD |
| Заявки/записи — копия менеджера без bulk | Admin operations с bulk, CRM export, audit записей |
| ИИ размазан по обзору | Отдельная зона **ИИ-студия** (5 разделов) |
| Обращения не в меню админа | `/operations/contacts` |
| `productConfig` только в коде | `SiteSettings` в DB + `ProductConfigProvider` на сайте |
| Аудит — сырой action string | Human labels, фильтры, CSV |
| Нет conflicts inbox | `/integrations/conflicts` |
| Нет command palette / dark admin | `Ctrl+K`, тёмная тема по умолчанию в админке |

**Ключевые файлы (актуальное состояние):**

```
frontend/src/
  config/
    dashboardNav.ts          # 7 зон adminNavGroups
    adminRoutes.ts             # заголовки + breadcrumbs
    adminPermissions.ts        # useAdminPermission
    ProductConfigProvider.tsx  # runtime site config
  components/admin/
    AdminStatusStrip.tsx
    AdminBreadcrumbs.tsx
    AdminCommandPalette.tsx
    ActionInbox.tsx
  components/analytics/
    AnalyticsFunnelChart.tsx
    AnalyticsBulletChart.tsx
  hooks/
    useAdminSystemStatus.ts
    useAdminCommandPalette.ts
    useAdminPermission.ts
  pages/admin/
    AdminOverviewPage.tsx      # Пульт
    AdminAnalyticsPage.tsx
    AdminUsersPage.tsx
    AdminAuditPage.tsx
    AdminIntegrationsPage.tsx
    AdminIntegrationJobsPage.tsx
    AdminIntegrationConflictsPage.tsx
    AdminIntegrationDetailPage.tsx
    ai/                        # 5 страниц ИИ-студии
    site/                      # 4 страницы CMS
    team/AdminTeamActivityPage.tsx
  api/
    adminAi.ts
    adminReference.ts
    adminSite.ts
  lib/auditLabels.ts

backend/src/modules/
  admin/admin.router.js
  admin/siteSettings.service.js
  admin/adminAiMemory.service.js
  eval/consultationEval.service.js  # eval для /admin/llm-eval
  integrations/integrations.service.js  # listConflicts global
  analytics/analytics.service.js      # kpi с days + funnel steps
```

---

## Модель ролей

### Текущие роли

| Роль | Зона | Позиционирование |
|------|------|------------------|
| `CLIENT` | `/dashboard/client` | Не админка; админ видит агрегаты |
| `MANAGER` | `/dashboard/manager` | Операционный кабинет; админ наследует + расширяет |
| `ADMINISTRATOR` | `/dashboard/admin` | Полный пульт; `RoleSwitcher` для проверки UX других ролей |

### Гранулярные права (фаза 2 — hooks заложены в UI)

```
admin.*
├── analytics.view          # ✅ useAdminPermission — аналитика, command palette
├── integrations.manage     # ✅ зона Интеграции
├── users.manage            # ✅ /team/users
├── security.audit          # ✅ /security/audit
├── ai.studio               # ✅ зона ИИ-студия
├── site.cms                # ✅ зона Сайт и бренд
├── operations.all          # ✅ зона Операции
└── team.activity           # ✅ /team/activity
```

Реализация: `frontend/src/config/adminPermissions.ts` + `useAdminPermission()`.  
Сейчас `ADMINISTRATOR` имеет все права; делегирование ролям — фаза 2.

---

## Информационная архитектура

```
/dashboard/admin
│
├── ПУЛЬТ                          /dashboard/admin
│
├── АНАЛИТИКА                      /dashboard/admin/analytics
│   ├── Обзор                       ?tab=overview
│   ├── Воронка                     ?tab=funnel
│   ├── Качество ИИ                 ?tab=ai-quality
│   ├── Менеджеры                   ?tab=managers
│   └── Экспорт                     ?tab=export
│
├── ОПЕРАЦИИ                       /dashboard/admin/operations
│   ├── Заявки                      /operations/requests
│   ├── Записи                      /operations/bookings
│   ├── Клиенты                     /operations/clients
│   └── Обращения                   /operations/contacts
│
├── КОМАНДА                        /dashboard/admin/team
│   ├── Пользователи                /team/users
│   └── Активность                  /team/activity
│
├── ИИ-СТУДИЯ                      /dashboard/admin/ai
│   ├── Статус и модели             /ai/status
│   ├── Сценарии                    /ai/scenarios
│   ├── Справочники                 /ai/reference
│   ├── Память кейсов               /ai/memory
│   └── Обратная связь              /ai/feedback
│
├── САЙТ И БРЕНД                   /dashboard/admin/site
│   ├── Услуги / работы / галерея   /site/items
│   ├── Текстовые блоки             /site/blocks
│   ├── Оформление                  /site/appearance
│   └── Контакты и юр. данные       /site/legal
│
├── ИНТЕГРАЦИИ                     /dashboard/admin/integrations
│   ├── Подключения                 /integrations
│   ├── Очередь                     /integrations/jobs
│   ├── Конфликты                   /integrations/conflicts
│   └── Деталь подключения          /integrations/:id
│
├── БЕЗОПАСНОСТЬ                   /dashboard/admin/security
│   ├── Журнал действий             /security/audit
│   └── Сессии (фаза 2)             /security/sessions
│
└── Профиль                        /dashboard/admin/profile
```

### Глобальный shell (на всех страницах)

- [x] **Status Strip** — ИИ · CRM · Очередь · Новые заявки (кликабельные)
- [x] **Command Palette** `Ctrl+K` — навигация по разделам админки (+ кнопка «Поиск» в топбаре)
- [x] **Breadcrumbs** — 3+ уровня
- [x] **Период** — селектор в аналитике (сегодня / 7 / 30 / 90), URL `?period=`

### Миграция URL (обратная совместимость)

| Старый URL | Новый URL |
|------------|-----------|
| `/dashboard/admin` | без изменений (Пульт) |
| `/dashboard/admin/analytics` | без изменений |
| `/dashboard/admin/users` | `/dashboard/admin/team/users` (+ redirect) |
| `/dashboard/admin/requests` | `/dashboard/admin/operations/requests` (+ redirect) |
| `/dashboard/admin/bookings` | `/dashboard/admin/operations/bookings` (+ redirect) |
| `/dashboard/admin/content` | `/dashboard/admin/site/items` (+ redirect) |
| `/dashboard/admin/appearance` | `/dashboard/admin/site/appearance` (+ redirect) |
| `/dashboard/admin/audit` | `/dashboard/admin/security/audit` (+ redirect) |
| `/dashboard/admin/integrations/*` | без изменений |

---

## Дизайн-система

### Токены

| Токен | Значение |
|-------|----------|
| Primary | `#EA580C` |
| Surface light | `#FFFFFF` |
| Surface dark | `#0B0D12` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Danger | `#DC2626` |
| Muted text | `#64748B` |
| Font body | Inter |
| Font mono | Fira Code (ID, логи, метрики) |
| Card padding | 12px (dense) |
| Table row height | 40px |
| Border radius | 8px cards, 6px buttons |
| Icons | Lucide, без emoji |

### Layout shell

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Автосервис · Админ    [ИИ][CRM][Очередь]  [⌘K] [👤]  │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumbs: Операции › Заявки                  │
│ (7 зон)  │  ┌─────────────────────────────────────────────┐ │
│          │  │ Page Header + actions                       │ │
│          │  ├─────────────────────────────────────────────┤ │
│          │  │              Content                        │ │
│          │  └─────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

### UX-правила

- Таблицы: `overflow-x-auto` на mobile → card layout
- Bulk actions: checkbox column + sticky action bar
- Skip link «Перейти к содержимому»
- `prefers-reduced-motion` — без stagger animation
- KPI: число всегда видно, не только на hover
- Funnel: текстовый fallback для screen readers
- Touch targets ≥ 44px

---

## Разделы: детальная спецификация

### 1. Пульт (`/dashboard/admin`)

**Назначение:** за 10 секунд ответить «всё ли в порядке?».

#### Блоки (Bento Grid: 4 col desktop, 2 tablet, 1 mobile)

- [x] Status Strip (ИИ / CRM / Очередь / Новые заявки) — в топбаре
- [x] KPI Row: консультации · заявки · записи · конверсия
- [x] Action Inbox (предупреждения P0–P2)
- [x] Карточка ИИ-модуля (circuit breaker, p95, fallback %, модели) — ссылка на `/ai/status`
- [x] Операции сейчас (NEW заявки, записи сегодня, обращения)
- [ ] Карточка команды (менеджеры активные / заблокированные) — частично через KPI
- [x] Интеграции (enabled / errors / last sync)
- [ ] Activity Feed на пульте (есть отдельно `/team/activity`)

#### Быстрые действия

- [x] Пригласить менеджера → `/team/users`
- [x] Подключить CRM → `/integrations`
- [x] Запустить probe ИИ → `/ai/status`
- [x] Экспорт KPI → `/analytics?tab=export`

#### Action Inbox — приоритеты

| Приоритет | Условие | Действие |
|-----------|---------|----------|
| P0 | ИИ unavailable | → `/ai/status` |
| P0 | CRM AUTH_ERROR | → `/integrations` |
| P1 | 0 активных менеджеров | → `/team/users` |
| P1 | Очередь > 10 failed jobs | → `/integrations/jobs` |
| P2 | Нет активных интеграций | → `/integrations` |

Реализовано в `ActionInbox.tsx` на пульте.

---

### 2. Аналитика (`/dashboard/admin/analytics`)

**Вкладки (URL-sync):** `?tab=` + `?period=`

#### Tab: Обзор (`?tab=overview`)

- [x] 6 bullet charts (консультации, заявки, записи, 3 конверсии)
- [ ] Sparkline за период
- [ ] Сравнение с прошлым периодом (↑↓%)

#### Tab: Воронка (`?tab=funnel`)

- [x] Funnel chart: консультация → заявка → запись → завершено (`AnalyticsFunnelChart`)
- [x] Drop-off % между стадиями
- [x] Drill-down: клик на стадию → ссылка на список

#### Tab: Качество ИИ (`?tab=ai-quality`)

- [x] Accuracy: верный / частично / неверный (badges + метрики)
- [x] Топ ошибок по категориям (bar list)
- [ ] p95 latency / fallback trend на этой вкладке (есть на `/ai/status`)
- [x] Ссылка на `/ai/feedback`

#### Tab: Менеджеры (`?tab=managers`)

- [x] Таблица: менеджер · сообщения · активные заявки
- [ ] avg response · feedback per manager
- [ ] Сортировка, экспорт CSV с этой вкладки

#### Tab: Экспорт (`?tab=export`)

- [x] KPI CSV, AI feedback CSV
- [x] Preset «Отчёт для руководства» (текстовая сводка)

**Период:** Сегодня · 7 · 30 · 90 (custom range — фаза 2)

**API:** `GET /analytics/kpi?days=N`, `GET /analytics/kpi.csv?days=N`, `GET /analytics/ai-feedback`, `GET /analytics/ai-feedback.csv`

---

### 3. Операции (`/dashboard/admin/operations/*`)

> Реализация: reuse страниц менеджера с пропом `adminZone` (breadcrumbs, admin-ссылки, расширения). Отдельные `AdminOperations*` страницы — фаза 2.

#### 3.1 Заявки (`/operations/requests`)

- [x] Виды: таблица · канбан
- [ ] Календарь SLA (фаза 2)
- [x] Фильтры: статус, срочность ИИ, feedback, SLA, источник, период
- [x] Bulk: смена статуса, назначение менеджера, экспорт в CRM (`BulkActionBar`)
- [x] Колонки: ID · клиент · авто · симптом · статус · feedback badges
- [x] Карточка заявки — через `/dashboard/manager/requests/:id` (admin может открыть)
- [ ] Admin-only: soft delete (фаза 2)

#### 3.2 Записи (`/operations/bookings`)

- [x] Календарь день/неделя + список
- [x] Загрузка постов (capacity bars на 7 дней, adminZone)
- [x] Audit log в `BookingDrawer` (`GET /bookings/:id/audit`)
- [ ] Bulk: перенос, отмена (фаза 2)

#### 3.3 Клиенты (`/operations/clients`)

- [x] Список клиентов с поиском, метрики LTV
- [x] Досье: заявки, записи, консультации, timeline (adminZone)

#### 3.4 Обращения (`/operations/contacts`)

- [x] Inbox: новые / в работе / закрыты
- [x] Конвертация в заявку

**API:** `/api/service-requests/*`, `/api/bookings/*`, `/api/contact`, client dossier

---

### 4. Команда (`/dashboard/admin/team/*`)

#### 4.1 Пользователи (`/team/users`)

- [ ] Поиск по email, имени (фаза 2)
- [ ] Фильтр: роль, статус (фаза 2)
- [x] Таблица: имя · email · роль · blocked
- [x] Смена роли
- [x] Block/unblock
- [ ] Защита последнего админа (фаза 2)
- [ ] Badge «Вы» (фаза 2)
- [ ] Invite flow (фаза 2)

#### 4.2 Активность (`/team/activity`)

- [x] Лента: аудит + операционные события (`AdminTeamActivityPage`)
- [x] Heatmap по часам

**API:** `GET/PATCH/POST /admin/users/*`

---

### 5. ИИ-студия (`/dashboard/admin/ai/*`)

> Главный новый модуль. Связывает roadmap и скрытый API `/admin/reference/*`.

#### 5.1 Статус и модели (`/ai/status`)

- [x] Карточка: ok / degraded / unavailable / disabled
- [x] Кнопка Probe now (`?probe=true`)
- [x] Модели: extraction, diagnosis, embedding
- [x] Метрики: p95, fallback rate, circuit breaker, cache
- [x] Badge eval-набора + карточка (`GET /admin/llm-eval`)
- [ ] Toggle LLM_FALLBACK (фаза 2)
- [ ] A/B промптов (фаза 2)

**API:** `GET /admin/llm-status`, `GET /admin/llm-eval`

#### 5.2 Сценарии (`/ai/scenarios`)

- [x] Список сценариев с категорией и количеством вопросов
- [x] Редактор: метаданные · вопросы · подсказки (CRUD)
- [ ] Drag-reorder вопросов (фаза 2)
- [ ] Preview симуляции (фаза 2)

#### 5.3 Справочники (`/ai/reference`)

- [x] Категории услуг
- [x] Reference materials
- [ ] OBD-коды в UI (фаза 2)

#### 5.4 Память кейсов (`/ai/memory`)

- [x] Статистика индексации
- [x] Backfill
- [x] Semantic search test UI
- [x] Embedding model status в stats

#### 5.5 Обратная связь (`/ai/feedback`)

- [x] Таблица feedback + метрики
- [x] Топ расхождений и категории ошибок
- [ ] Drill-down diff ИИ vs реальность (фаза 2)

---

### 6. Сайт и бренд (`/dashboard/admin/site/*`)

#### 6.1 Услуги / работы / галерея (`/site/items`)

- [x] Табы: Услуги · Работы · Галерея
- [x] CRUD + drag-reorder
- [x] Форма: заголовок, описание, цена «от», фото, published
- [ ] Live preview (iframe публичной страницы) — фаза 2

**API:** `/admin/site-items` CRUD + reorder

#### 6.2 Текстовые блоки (`/site/blocks`)

- [x] Группировка по section (hero, about, footer…)
- [x] Markdown editor
- [x] История версий + rollback
- [ ] Diff между версиями (фаза 2)

**API:** `/admin/site-content` CRUD + rollback

#### 6.3 Оформление (`/site/appearance`)

- [ ] Логотип upload (фаза 2)
- [x] Цвета: primary, secondary, accent (color picker)
- [x] Название, телефон, часы, адрес, имя ассистента, карта
- [x] Сохранение в DB (`SiteSettings`)
- [ ] WCAG check + live preview iframe (фаза 2)

**API:** `GET/PATCH /admin/site-settings`, публичный `GET /content/site-settings`

#### 6.4 Контакты и юр. данные (`/site/legal`)

- [x] Реквизиты оператора ПДн
- [x] Ссылки на политику, оферту
- [x] Preview документов (ссылки на `/privacy`, `/terms`)

---

### 7. Интеграции (`/dashboard/admin/integrations/*`)

#### 7.1 Подключения

- [x] Карточки: провайдер · статус · last sync · enabled toggle
- [x] Мастер подключения (GENERIC_REST)
- [ ] Остальные провайдеры — «скоро» (как в спеке)

#### 7.2 Очередь (`/integrations/jobs`)

- [x] Таблица: job · connection · type · status · attempts
- [x] Bulk retry / cancel
- [x] Фильтр failed only

#### 7.3 Конфликты (`/integrations/conflicts`)

- [x] Inbox unresolved conflicts (`GET /admin/integration-conflicts`)
- [x] Diff local vs external
- [x] Resolve: take local / take external

#### 7.4 Деталь подключения (`/integrations/:id`)

- [x] Табы: Обзор · Возможности · Задачи · Конфликты · Логи
- [ ] Health timeline (фаза 2)
- [ ] Webhook events (фаза 2)

**API:** `/admin/integrations/*`, `GET /admin/integration-conflicts`, jobs endpoints

---

### 8. Безопасность (`/dashboard/admin/security/*`)

#### 8.1 Журнал аудита (`/security/audit`)

- [x] Human-readable labels (`auditLabels.ts`)
- [x] Фильтры: action, entityType, user, date range
- [x] JSON payload — collapsible
- [x] Экспорт CSV
- [x] События: смена роли, block, CMS edit в `AdminAuditEvent`

#### 8.2 Сессии (фаза 2)

- [ ] Активные refresh tokens
- [ ] Force logout

**API:** `GET /admin/audit-events` (query filters)

---

## API → UI: матрица (актуально)

| API | UI | Статус |
|-----|-----|--------|
| `/admin/site-content` CRUD + rollback | `/site/blocks` | ✅ |
| `/admin/site-items` CRUD + reorder | `/site/items` | ✅ |
| `/admin/reference/*` | `/ai/scenarios`, `/ai/reference` | ✅ |
| `/admin/llm-status` | `/ai/status` + Status Strip | ✅ |
| `/admin/llm-eval` | badge на `/ai/status` | ✅ |
| `/analytics/ai-feedback` | `/analytics?tab=ai-quality` + `/ai/feedback` | ✅ |
| `/admin/integration-conflicts` | `/integrations/conflicts` | ✅ |
| contacts API | `/operations/contacts` (adminZone) | ✅ |
| `/admin/ai/memory/*` | `/ai/memory` | ✅ |
| `GET/PATCH /admin/site-settings` | `/site/appearance` + публичный сайт | ✅ |
| `GET /analytics/kpi?days=` | `/analytics` (bullet + funnel) | ✅ |
| `GET /bookings/:id/audit` | audit в `BookingDrawer` (adminZone) | ✅ |
| `GET /admin/audit-events` | `/security/audit` | ✅ |

---

## Мобильная адаптация

| Breakpoint | Поведение |
|------------|-----------|
| `< 768px` | Sidebar → drawer; Status strip → 1 иконка |
| Таблицы | Card list с ключевыми полями |
| Канбан | Горизонтальный scroll |
| Command palette | Full-screen search |
| Touch | ≥ 44px targets |

---

## План внедрения

### Фаза A — Foundation (1–2 нед.)

**Цель:** новый каркас и первые рабочие экраны.

- [x] Обновить `dashboardNav.ts` — 7 зон навигации
- [x] Реструктурировать роуты в `router.tsx` + legacy redirects
- [x] Компонент `AdminStatusStrip`
- [x] Компонент `AdminBreadcrumbs`
- [x] Пульт v2 — bento grid, action inbox
- [x] `/operations/contacts` — inbox обращений
- [x] `/operations/requests` — admin-таблица с фильтрами (без bulk)
- [x] Перенести users → `/team/users`
- [x] `/ai/status` — базовая страница статуса ИИ
- [x] Placeholder-страницы для фаз B–D

**Критерий готовности:** админ заходит, видит новую навигацию, пульт, обращения, заявки без перехода в менеджер.

---

### Фаза B — ИИ-студия (2–3 нед.)

**Цель:** закрыть главный пробел — управление ИИ без разработчика.

- [x] `/ai/status` — полная карточка LLM
- [x] `/ai/scenarios` — CRUD сценариев, вопросов, подсказок
- [x] `/ai/reference` — категории, materials
- [x] `/ai/feedback` — таблица + drill-down
- [x] `/ai/memory` — stats + semantic search test
- [x] Backend: `POST /admin/ai/memory/backfill`, `GET stats`, `POST search`
- [x] Frontend API client: `api/adminAi.ts`, `api/adminReference.ts`

**Критерий готовности:** админ создаёт сценарий, видит статус ИИ, ищет похожие кейсы.

---

### Фаза C — CMS полный (2 нед.)

**Цель:** сайт редактируется без кода.

- [x] `/site/items` — CRUD + reorder + preview
- [x] `/site/blocks` — CRUD + версии + rollback
- [x] `/site/appearance` — editable white-label
- [x] `/site/legal` — реквизиты
- [x] Backend: `GET/PATCH /admin/site-settings` (модель `SiteSettings` или JSON в DB)
- [x] Frontend API: `api/adminSite.ts`
- [x] `ProductConfigProvider` — публичный сайт читает настройки из API

**Критерий готовности:** админ меняет услугу, текст hero, цвет бренда — видно на публичном сайте.

---

### Фаза D — Аналитика и интеграции v2 (1–2 нед.)

**Цель:** data viz и полный контроль интеграций.

- [x] Аналитика: funnel chart, bullet KPI, drill-down, 5 табов
- [x] `/integrations/conflicts` — top-level inbox
- [x] Bulk retry/cancel в очереди
- [x] `/security/audit` v2 — фильтры, labels, export
- [x] `/operations/bookings` — admin calendar + audit panel
- [x] `/operations/clients` — досье клиента

**Критерий готовности:** воронка на графике, конфликты CRM в отдельном inbox, аудит с фильтрами.

---

### Фаза E — Polish (1 нед.)

**Цель:** production-ready UX.

- [x] Command palette `Ctrl+K`
- [x] Dark mode для админки
- [x] Permission hooks (`useAdminPermission`)
- [x] Eval badge в ИИ-студии
- [x] Bulk actions в заявках
- [x] `/team/activity`
- [x] E2E smoke: admin navigates all zones

**Критерий готовности:** демо-сценарий админа из [demo-defense.md](./demo-defense.md) проходит на новой админке.

---

## KPI успеха редизайна

| Метрика | Baseline | Цель |
|---------|----------|------|
| Время до диагностики проблемы на пульте | ~30 сек (сканирование) | ≤ 10 сек |
| Операции без переключения на менеджера | ~40% | 100% |
| Admin API с UI | ~60% | 100% |
| Настройка сценария ИИ без dev | нет | да |
| Редактирование сайта без кода | нет | да |
| WCAG AA на ключевых экранах | частично | да |

---

## Файловая структура (реализовано)

```
frontend/src/
  config/
    dashboardNav.ts              # 7 зон adminNavGroups
    adminRoutes.ts               # заголовки + breadcrumbs
    adminPermissions.ts          # useAdminPermission
  providers/
    ProductConfigProvider.tsx    # runtime site config из API
  pages/admin/
    AdminOverviewPage.tsx        # Пульт (bento + Action Inbox)
    AdminAnalyticsPage.tsx       # 5 вкладок
    AdminUsersPage.tsx           # → /team/users
    AdminAuditPage.tsx           # → /security/audit
    AdminIntegrationsPage.tsx
    AdminIntegrationDetailPage.tsx
    AdminIntegrationJobsPage.tsx
    AdminIntegrationConflictsPage.tsx
    team/
      AdminTeamActivityPage.tsx
    ai/
      AdminAiStatusPage.tsx
      AdminAiScenariosPage.tsx
      AdminAiReferencePage.tsx
      AdminAiMemoryPage.tsx
      AdminAiFeedbackPage.tsx
    site/
      AdminSiteItemsPage.tsx
      AdminSiteBlocksPage.tsx
      AdminSiteAppearancePage.tsx
      AdminSiteLegalPage.tsx
  pages/manager/                 # reuse с adminZone
    ManagerRequestsPage.tsx
    ManagerCalendarPage.tsx
    ManagerClientsPage.tsx
    ManagerContactsPage.tsx
  components/admin/
    AdminStatusStrip.tsx
    AdminBreadcrumbs.tsx
    AdminCommandPalette.tsx
    ActionInbox.tsx
    AnalyticsFunnelChart.tsx
    AnalyticsBulletChart.tsx
  lib/
    auditLabels.ts
  hooks/
    useAdminSystemStatus.ts
    useAdminCommandPalette.ts
    useAdminPermission.ts
  api/
    adminAi.ts
    adminReference.ts
    adminSite.ts

backend/src/modules/admin/
  admin.router.js                # site-settings, ai/memory, llm-eval, conflicts
  siteSettings.service.js
  adminAiMemory.service.js

backend/src/modules/eval/
  consultationEval.service.js
  scenarios.json

tests/e2e/
  admin-nav-smoke.spec.js
```

---

## Журнал прогресса

| Дата | Что сделано | Фаза |
|------|-------------|------|
| 2026-07-30 | Создана спецификация `admin-redesign-spec.md` | — |
| 2026-07-30 | Фаза A: 7 зон, shell, пульт v2, operations adminZone, legacy redirects | A |
| 2026-07-30 | Фаза B: ИИ-студия — сценарии, справочники, feedback, память кейсов, API memory | B |
| 2026-07-30 | Фаза C: CMS — site items/blocks/appearance/legal, SiteSettings API, ProductConfigProvider | C |
| 2026-07-30 | Фаза D: аналитика v2, conflicts inbox, audit v2, bookings audit, clients timeline | D |
| 2026-07-30 | Фаза E: command palette, dark admin, permissions, eval badge, team activity, E2E smoke | E |
| 2026-07-30 | Документация синхронизирована с реализацией (spec, ONBOARDING, demo-defense) | — |

---

## Заметки и решения

- **Приоритет:** Фаза A → B → C → D → E — выполнено
- **Операции:** reuse менеджерских страниц с `adminZone` вместо отдельных `AdminOperations*` (быстрее, меньше дублирования; отдельные views — backlog)
- **Бренд:** сохраняем `#EA580C`, не меняем на purple из ui-ux-pro-max
- **Стек UI:** существующие компоненты (`Card`, `Tabs`, `Button`) + кастомные `AnalyticsFunnelChart` / `AnalyticsBulletChart`
- **Не трогать:** кабинеты CLIENT и MANAGER (только admin zone и публичный сайт через `ProductConfigProvider`)
- **Legacy URLs:** `/dashboard/admin/users` → `/team/users`, `/dashboard/admin/audit` → `/security/audit` (redirect в `router.tsx`)
