# Переосмысление роли «Менеджер»

> Рабочий документ: отмечай прогресс галочками `[x]`.  
> Связанные материалы: [ai-improvement-roadmap.md](./ai-improvement-roadmap.md), [architecture.md](./architecture.md), [demo-defense.md](./demo-defense.md).

**Статус:** ✅ Реализовано полностью (фазы A–C + финальная полировка)  
**Последнее обновление:** 2026-07-30

---

## Сводка реализации

Кабинет менеджера переведён из CRUD-набора страниц в операционный центр приёмщика. Все пункты чеклистов §1–8 и roadmap §11 закрыты.

| Область | Ключевое |
|---------|----------|
| **Рабочий стол** | «Сделать сейчас», bullet KPI, воронка, ближайшие записи + drawer, activity feed, polling 60 с |
| **Очередь** | Список + канбан DnD, 10+ фильтров, сохранённые пресеты, bulk (статус, CRM, назначение) |
| **Карточка заявки** | 5 вкладок, сводка с быстрой оценкой ИИ, фото/этапы, переписка с вложениями, audit статусов, 409 diff |
| **Календарь** | Drawer записи, статусы ARRIVED/NO_SHOW, фильтры сегодня/мои/с заявкой |
| **Клиенты** | Master-detail, гостевое досье, LTV, вкладки, автомобили |
| **Входящие** | Workflow + конвертация + консультация с prefill, поле `source` |
| **Качество ИИ** | Bullet/bar charts, inline-оценка >24 ч, CSV |
| **Backend** | 4 миграции phase B–final, manager KPI, activity, SLA Telegram, attachments storage |

**Демо:** `manager@example.local` / `Manager-Demo-2026!` → https://autoservice-demo.zernov.online

---

## Цель

Превратить кабинет менеджера из набора CRUD-страниц в **операционный центр приёмщика автосервиса** — место, где заявка после ИИ-консультации быстро превращается в визит, работу и обратную связь для улучшения диагностики.

**Главная метрика роли:** время от «новая заявка» до «клиент записан / получил ответ» (цель ≤ 15 мин в рабочее время).

**Принцип UX:** data-dense, но scannable — статусы не только цветом, KPI как bullet charts, воронка конверсии, без декоративного шума. Design system: ui-ux-pro-max (dense dashboard, `#2563EB` primary, status green/amber/red).

---

## Кто такой менеджер в продукте

**Не «админ lite»**, а операционный приёмщик, который:

1. Берёт заявку после ИИ-консультации и превращает её в визит/работу
2. Общается с клиентом (телефон, чат, запись)
3. Оценивает качество диагноза ИИ → замыкает контур обучения
4. Передаёт данные в CRM/1С
5. Видит свой день: что горит, что скоро в календаре, что без ответа

---

## Текущее состояние (после реализации)

### Навигация

| Раздел | Путь | Файл |
|--------|------|------|
| Рабочий стол | `/dashboard/manager` | `ManagerWorkDeskPage.tsx` |
| Очередь | `/dashboard/manager/requests` | `ManagerRequestsPage.tsx` |
| Карточка заявки | `/dashboard/manager/requests/:id` | `ManagerRequestDetailPage.tsx` |
| Календарь | `/dashboard/manager/calendar` | `ManagerCalendarPage.tsx` |
| Клиенты | `/dashboard/manager/clients` | `ManagerClientsPage.tsx` |
| Входящие | `/dashboard/manager/contacts` | `ManagerContactsPage.tsx` |
| Качество ИИ | `/dashboard/manager/ai-quality` | `ManagerAiQualityPage.tsx` |

Конфиг: `frontend/src/config/dashboardNav.ts` → `managerNavItems` (6 разделов + профиль).

### Карточка заявки — вкладки (целевые 5)

1. **Сводка** — проблема, ИИ-диагноз, контакты, связанная запись, быстрая оценка
2. **Диалог ИИ** — чат, галерея фото, таймлайн этапов
3. **Переписка** — чат менеджер ↔ клиент, шаблоны, вложения (JPG/PNG/WEBP/GIF/PDF до 4 МБ)
4. **Работы и оценка** — feedback, итог ремонта, похожие кейсы
5. **История и CRM** — timeline, audit смены статусов, интеграции

### Решённые проблемы (было → стало)

| Было | Стало |
|------|-------|
| 6 вкладок, дубли overview/analysis | 5 вкладок, 80% работы на «Сводке» |
| Feedback ИИ спрятан | Быстрые кнопки на сводке + inline на странице «Качество ИИ» |
| Разрозненные списки на столе | Единая очередь «Сделать сейчас» с приоритетами |
| Календарь без связи с заявками | Drawer + prefill booking + `serviceRequestId` |
| Гости disabled | `GET /guest-dossier/:phone`, кликабельные гости в списке |
| Входящие — таблица | Workflow: статусы, конвертация, консультация, `source` |
| Аналитика ИИ только у админа | `/dashboard/manager/ai-quality` |
| Нет SLA / назначения | SLA badges, `assignedManagerId`, picker менеджера, таб «Мои» |

### Что уже есть (не ломать)

- [x] Список/канбан заявок + фильтры + поиск
- [x] Смена статуса с optimistic locking (`version`, 409)
- [x] Переписка менеджер ↔ клиент
- [x] Полный диалог ИИ + `DiagnosticSummary`
- [x] `ConsultationFeedbackPanel` (вердикт, причина, работы)
- [x] CRM export + retry jobs
- [x] Client dossier API
- [x] `getAiFeedbackReport()` в админке
- [x] Telegram notify при новой заявке

---

## Целевая информационная архитектура

### Боковое меню — 6 разделов

| # | Раздел | Путь | Badge |
|---|--------|------|-------|
| 1 | **Рабочий стол** | `/dashboard/manager` | — |
| 2 | **Очередь** | `/dashboard/manager/requests` | NEW + SLA |
| 3 | **Календарь** | `/dashboard/manager/calendar` | сегодня |
| 4 | **Клиенты** | `/dashboard/manager/clients` | — |
| 5 | **Входящие** | `/dashboard/manager/contacts` | необработанные |
| 6 | **Качество ИИ** | `/dashboard/manager/ai-quality` | без оценки |
| — | Профиль | `/dashboard/manager/profile` | — |

### Переименования

- «Заявки» → **«Очередь»**
- «Обращения» → **«Входящие»**
- **Новый:** «Качество ИИ»

### Быстрые действия (topbar / FAB)

- Позвонить (последний клиент из очереди)
- Создать запись
- Запустить консультацию от имени клиента (на стойке)
- Передать в CRM (если открыта заявка)

---

## 1. Рабочий стол (`ManagerWorkDeskPage`)

### 1.1 Верх: контекст дня

- [x] Дата и приветствие по имени менеджера
- [x] Счётчик «N задач требуют внимания»
- [x] Кнопка «Обновить» + авто-refresh 60 с (опционально)

### 1.2 KPI-полоса (4 кликабельные карточки)

| KPI | Источник | Клик → |
|-----|----------|--------|
| Новые | `status=NEW` | Очередь, фильтр NEW |
| Без ответа >4ч | SLA-логика | Очередь, «просрочено» |
| Сегодня в календаре | bookings today | Календарь, день |
| Без оценки ИИ | COMPLETED без feedback | Качество ИИ |

- [x] Bullet KPI: факт / цель / зона (текст + цвет, не color-only)
- [x] Кликабельные ссылки на соответствующие разделы

### 1.3 Блок «Сделать сейчас» (единая приоритетная очередь)

Сортировка:

1. Critical urgency из диагноза ИИ
2. NEW без назначенного менеджера
3. IN_PROGRESS > SLA (4ч без изменений — уже частично есть)
4. Запись через < 2 ч
5. Входящее с сайта < 1 ч

Каждая строка:

```
[срочность] №0042 · BMW X5 · биение руля     [Открыть] [Позвонить]
Новая · 12 мин · ИИ: critical · гость +7900...
```

- [x] Объединить «Требуют внимания» + «Последние заявки» в один список
- [x] Бейджи: гость / зарегистрирован, urgency ИИ
- [x] Действия: открыть, `tel:` позвонить, быстрый статус
- [x] Убрать дублирующий `NotificationCenter` с контактами (только счётчик → Входящие)

### 1.4 Воронка за неделю

- [x] Funnel chart: Консультации → Заявки → Записи → Завершено
- [x] % конверсии между этапами
- [x] Подсветка biggest drop-off
- [x] API: manager-scoped KPI (см. Backend)

### 1.5 Ближайшие записи

- [x] Timeline следующих 6 записей с «через N мин»
- [x] Клик → drawer записи (не просто календарь)
- [x] Связь с заявкой, если есть

### 1.6 Лента активности

- [x] 10 последних событий: заявки, сообщения, CRM, feedback
- [x] Ссылка «Вся история»

### 1.7 Hint CRM

- [x] Показывать только при failed integration jobs (не всегда)

**Критерий готовности:** менеджер за ≤ 2 клика открывает самую срочную заявку с рабочего стола.

---

## 2. Очередь (`ManagerRequestsPage`)

### 2.1 Режимы просмотра

| Режим | Описание |
|-------|----------|
| Список | DataTable, сортировка, пагинация |
| Канбан | Drag-and-drop статусов |
| Мои | Только назначенные на текущего менеджера (фаза B) |

- [x] Переименовать заголовок «Заявки» → «Очередь»
- [x] Таб «Мои» (после `assignedManagerId`)

### 2.2 Фильтры

- [x] Статус (один)
- [x] Статус (мультиселект)
- [x] Срочность ИИ: critical / high / normal
- [x] Источник: консультация / гость / форма / запись
- [x] Период: сегодня / 7 дней / всё
- [x] Есть диагноз / нет
- [x] Оценка ИИ: не оценено / верно / частично / неверно
- [x] SLA: просрочено
- [x] Сохранённые фильтры: «Новые с critical», «Без ответа»

### 2.3 Колонки списка (расширить)

| Колонка | Содержание |
|---------|------------|
| № | Ссылка + бейдж NEW |
| Клиент | Имя + телефон (копировать) |
| Авто | Марка модель |
| Проблема | Симптомы, 2 строки |
| ИИ | Confidence %, urgency |
| Статус | StatusBadge |
| SLA | «2ч без ответа» / OK |
| Менеджер | Кто ведёт (фаза B) |
| Дата | createdAt + relative |

- [x] Добавить колонки ИИ, SLA, relative time
- [x] Копирование телефона из списка

### 2.4 Канбан

- [x] Колонки по статусам
- [x] Drag-and-drop между колонками
- [x] Карточка: urgency, возраст, менеджер
- [x] WIP-limit визуально на «Новые»
- [x] Свёрнутая колонка «Отменено»

### 2.5 Bulk-действия (фаза C)

- [x] Назначить на себя
- [x] Назначить другому менеджеру (picker + bulk)
- [x] Сменить статус
- [x] Экспорт в CRM пачкой

**Критерий готовности:** канбан с DnD, фильтр по urgency, ≤ 3 клика до карточки.

---

## 3. Карточка заявки (`ManagerRequestDetailPage`)

### 3.1 Sticky summary bar (всегда видна)

```
№0042  [В работе ▼]   Иван Петров  +7900...  [📋] [📞] [📅] [↗CRM]
BMW X5 2015 · биение руля · ИИ: 78% · critical
```

- [x] Статус, клиент, авто, дата
- [x] Скопировать телефон
- [x] Передать в CRM
- [x] Кнопка «Позвонить» (`tel:`)
- [x] Назначить визит с prefill из заявки (не голый `/booking`)
- [x] Показать confidence + urgency на summary bar
- [x] Назначить менеджера — picker (`ManagerPicker`) + `PATCH .../assign-manager`

### 3.2 Новая структура вкладок (5 вместо 6)

| # | Вкладка | Содержание |
|---|---------|------------|
| 1 | **Сводка** | Проблема + ИИ-диагноз + контакты + быстрая оценка |
| 2 | **Диалог ИИ** | Чат, фото, этапы |
| 3 | **Переписка** | Чат менеджер ↔ клиент + шаблоны |
| 4 | **Работы и оценка** | Feedback + итог ремонта + похожие кейсы |
| 5 | **История и CRM** | Timeline + интеграции |

Убрать отдельные вкладки «Обзор» и «Результат анализа».

#### Вкладка 1: Сводка

**Левая колонка (60%):**

- [x] Проблема клиента — симптомы, условия, пробег, OBD-коды
- [x] «Что понял ИИ» — extracted fields человекочитаемо (не raw keys)
- [x] Топ-3 причины с confidence bars
- [x] Рекомендуемые проверки — чеклист
- [x] Стоимость «от», срочность, «можно ли ехать»

**Правая колонка (40%):**

- [x] Контакты: имя, телефон, email, гость/клиент
- [x] Автомобиль: марка, модель, год, пробег
- [x] Связанная запись (если есть)
- [x] CRM-статус кратко
- [x] **Быстрая оценка ИИ** — 3 кнопки на сводке

#### Вкладка 2: Диалог ИИ

- [x] Полный чат консультации
- [x] Галерея фото (vision) с подписями
- [x] Таймлайн этапов: сбор → анализ → результат

#### Вкладка 3: Переписка

- [x] Чат менеджер ↔ клиент
- [x] Шаблоны: «Уточните VIN», «Запишем на диагностику», «Нужны фото»
- [x] Прикрепление файлов — `RequestFollowUpAttachment`, base64 upload, volume `uploads_data`

#### Вкладка 4: Работы и оценка

- [x] `ConsultationFeedbackPanel`
- [x] Блок «Итог ремонта»: сумма, заказ-наряд, дата (фаза C)
- [x] Похожие кейсы из case memory (фаза C)

#### Вкладка 5: История и CRM

- [x] Timeline (создание, сообщения, CRM jobs)
- [x] CRM links + retry
- [x] Полный аудит смены статусов (фаза C)
- [x] Diff при конфликте 409 (фаза C)

**Критерий готовности:** 80% работы менеджера на вкладке «Сводка», feedback в 2 клика.

---

## 4. Календарь (`ManagerCalendarPage`)

### Текущие проблемы

- Не связан с заявками
- День/неделя/список дублируют `BookingCalendar`
- Нет drawer карточки записи

### Целевое состояние

**Виды:** День | Неделя | Список

- [x] Drawer записи: клиент, телефон, авто, заявка №, статус
- [x] Статусы записи: ожидает / подтверждена / приехал / no-show
- [x] Действия: подтвердить, открыть заявку, перенести
- [x] Prefill диагноза ИИ для мастера в drawer
- [x] Фильтр: сегодня, мои, только с заявкой
- [x] Из заявки SCHEDULED → booking с prefill (связь `serviceRequestId`)

**Критерий готовности:** клик по записи открывает drawer с заявкой и контактами.

---

## 5. Клиенты (`ManagerClientsPage`)

### Целевое состояние: Master-Detail

**Левая панель:**

- [x] Поиск по имени/телефону
- [x] Фильтр: все / активные / гости
- [x] Сортировка: последняя активность / имя

**Карточка клиента:**

- [x] Профиль: имя, телефон, email, с какого года
- [x] Метрики: заявки, завершено, LTV (фаза C)
- [x] Автомобили из истории заявок
- [x] Активные заявки со ссылками
- [x] Вкладки: История / Записи / Консультации

**Гости:**

- [x] Досье по `guestPhone` (объединение без `clientId`)
- [x] Кнопки: позвонить, написать, создать заявку

**Критерий готовности:** гостевые обращения кликабельны, видна история по телефону.

---

## 6. Входящие (`ManagerContactsPage`)

### Целевое состояние: workflow, не таблица

**Статусы:** Новое → В работе → Конвертировано / Закрыто

- [x] `ContactSubmission.status` в Prisma + API
- [x] Карточка: имя, телефон, сообщение, источник
- [x] Действия: позвонить, создать заявку, запустить консультацию, закрыть
- [x] Badge необработанных на навигации
- [x] Попадание в «Сделать сейчас» на рабочем столе

**Критерий готовности:** менеджер конвертирует обращение в заявку за 2 клика.

---

## 7. Качество ИИ (`ManagerAiQualityPage` — новый)

### Содержание

**KPI (7 / 30 дней):**

- [x] Accuracy % (bullet chart)
- [x] Useful % (CORRECT + PARTIAL)
- [x] Количество оценок
- [x] Без оценки → ссылка на очередь

**Визуализации:**

- [x] Bar chart: топ ошибок по категориям
- [x] Таблица последних оценок

**Очередь «Нужна оценка»:**

- [x] Заявки COMPLETED/IN_PROGRESS > 24ч без feedback
- [x] Inline-оценка без полной карточки

**Прочее:**

- [x] Экспорт CSV (read-only, как в админке)
- [x] Роут `/dashboard/manager/ai-quality`
- [x] Пункт в `managerNavItems`

**API:** переиспользовать `GET /analytics/ai-feedback?days=N` (доступ менеджеру).

**Критерий готовности:** менеджер видит свой вклад в улучшение ИИ без входа в админку.

---

## 8. Design System

| Токен | Значение | Применение |
|-------|----------|------------|
| Primary | `#2563EB` | CTA, активные элементы |
| Accent | `#059669` | успех, верный диагноз |
| Destructive | `#DC2626` | critical, SLA breach |
| Warning | `#D97706` | partial, просрочка |
| Background | `#F8FAFC` | фон dashboard |
| Density | 8/10 | компактные таблицы |

**Правила:**

- [x] Статусы: цвет + текст (не color-only)
- [x] Номера заявок: monospace (`Fira Code` или system mono)
- [x] Таблицы: card layout на mobile (уже есть)
- [x] Анимации: 150–300ms, без overshoot на data tables
- [x] `prefers-reduced-motion` respected
- [x] Touch targets ≥ 44px на mobile actions

---

## 9. Backend: реализованная дельта

### Prisma / миграции

| Миграция | Содержание |
|----------|------------|
| `20260730120000_manager_ops_phase_b` | `assignedManagerId`, `firstResponseAt`, `ContactSubmission.status`, booking link |
| `20260730140000_manager_ops_phase_c` | repair outcome fields, `slaNotifiedAt`, case memory hooks |
| `20260730150000_manager_redesign_polish` | `ServiceRequestStatusLog`, booking `ARRIVED`/`NO_SHOW`, расширенные фильтры |
| `20260730180000_manager_redesign_final` | `ContactSubmission.source`, `RequestFollowUpAttachment` |

### API (менеджер)

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/service-requests` | Список + фильтры: `mine`, `sla`, `urgency`, `feedback`, `statuses`, `source`, `period`, `hasDiagnosis` |
| `GET` | `/api/service-requests/managers` | Список staff для picker |
| `PATCH` | `/api/service-requests/:id/assign-manager` | `{ managerId }` |
| `POST` | `/api/service-requests/:id/assign-to-me` | Назначить на себя |
| `POST` | `/api/service-requests/bulk/assign` | `{ ids, managerId? }` |
| `POST` | `/api/service-requests/bulk/status` | Массовая смена статуса |
| `POST` | `/api/service-requests/bulk/export-crm` | Массовый экспорт в CRM |
| `GET` | `/api/service-requests/activity` | Лента активности |
| `GET` | `/api/service-requests/:id/status-history` | Audit смены статусов |
| `GET` | `/api/service-requests/:id/similar-cases` | Похожие кейсы |
| `GET` | `/api/service-requests/guest-dossier/:phone` | Досье гостя |
| `GET` | `/api/service-requests/client-dossier/:clientId` | Досье клиента + LTV |
| `GET` | `/api/analytics/manager-kpi` | Воронка для рабочего стола |
| `GET` | `/api/manager/integrations` | CRM-подключения для менеджера |
| `GET/POST` | `/api/service-requests/:id/messages` | Переписка; POST с `{ body?, attachments? }` |
| `GET` | `/api/service-requests/:id/messages/:msgId/attachments/:attId` | Скачать вложение |
| `GET/PATCH/POST` | `/api/contact` | Входящие + `source` при создании |

### Фоновые задачи

- `slaEscalation.job.js` — Telegram при просрочке SLA
- Polling 60 с на фронте (`useDashboardPolling`) вместо WebSocket (осознанный trade-off)

### Хранилище вложений

- Env: `REQUEST_MESSAGE_UPLOAD_DIR` (в Docker: `/app/data/uploads/request-messages`)
- Volume: `uploads_data` в `docker-compose.yml`

---

## 10. User flows

### Flow 1: Новая заявка после консультации (демо BMW X5)

```
Уведомление на столе → Открыть №0042 → Сводка (диагноз, critical)
→ Позвонить → Статус «В работе» → Назначить визит (prefill)
→ Переписка → CRM export → После ремонта: оценка ИИ
```

**Целевое время:** < 3 мин до первого контакта.

### Flow 2: Гость с формы сайта

```
Входящие → Новое → Позвонить → Создать заявку → Очередь
```

### Flow 3: Просрочка SLA

```
Стол: «Без ответа 5ч» → Открыть → шаблон ответа → эскалация (фаза C)
```

---

## 11. Roadmap реализации

### Фаза A — Quick wins (1–2 недели)

**Цель:** менеджер работает быстрее без миграций БД (кроме booking link).

- [x] A1. Навигация: переименования + пункт «Качество ИИ»
- [x] A2. Карточка заявки: вкладка «Сводка» (объединить overview + analysis)
- [x] A3. Быстрая оценка ИИ на сводке
- [x] A4. Рабочий стол: блок «Сделать сейчас» (единая очередь)
- [x] A5. Summary bar: urgency + confidence + кнопка «Позвонить»
- [x] A6. Booking prefill из заявки (`serviceRequestId` query)
- [x] A7. Страница «Качество ИИ» (read-only, `getAiFeedbackReport`)

**Критерий фазы A:** демо-сценарий менеджера из [demo-defense.md](./demo-defense.md) проходит за ≤ 2 мин, feedback в 2 клика.

### Фаза B — Операционка (2–3 недели)

- [x] B1. Workflow входящих (status + конверсия в заявку)
- [x] B2. Расширенные фильтры очереди (urgency, оценка ИИ, SLA)
- [x] B3. DnD канбан
- [x] B4. Drawer записи в календаре
- [x] B5. `assignedManagerId` + таб «Мои»
- [x] B6. SLA badges (4ч без ответа)
- [x] B7. Гостевое досье по телефону
- [x] B8. Шаблоны сообщений (3–5 штук)

**Критерий фазы B:** входящие конвертируются в заявки, канбан с DnD, календарь связан с заявкой.

### Фаза C — CRM-уровень (3–4 недели)

- [x] C1. Воронка на рабочем столе (manager KPI API)
- [x] C2. Activity feed
- [x] C3. Bulk-действия в очереди
- [x] C4. Итог ремонта + LTV в клиентах
- [x] C5. Похожие кейсы в карточке заявки
- [x] C6. Эскалация SLA (Telegram)
- [x] C7. Авто-refresh 60 с (`useDashboardPolling`; WebSocket не делали)

### Фаза D — Финальная полировка (2026-07-30)

- [x] D1. Расширенные фильтры очереди (multiselect, source, period, hasDiagnosis, saved filters)
- [x] D2. Bulk export CRM, kanban WIP-limit, copy phone, NEW badge
- [x] D3. Карточка: photo gallery, stages timeline, status history, 409 diff, linked booking
- [x] D4. Календарь: фильтры сегодня/мои/с заявкой; клиенты: вкладки, LTV, автомобили
- [x] D5. AI quality: bullet charts, CategoryBarChart, InlineFeedbackQueue >24 ч
- [x] D6. **Назначение другого менеджера** — `GET /managers`, `PATCH /assign-manager`, `ManagerPicker`
- [x] D7. **Вложения в переписке** — `RequestFollowUpAttachment`, UI менеджер + клиент
- [x] D8. **Источник входящих** — `ContactSubmission.source`, бейдж во «Входящих», `about_page` с формы

**Критерий фазы D:** все пункты §1–8 закрыты, документ синхронизирован с кодом.

---

## 12. Метрики успеха

| Метрика | Baseline | Цель |
|---------|----------|------|
| Кликов до первого действия по заявке | ~4–5 | ≤ 2 |
| % заявок с оценкой ИИ | низкий | ≥ 60% завершённых |
| Время до первого ответа | не измеряется | p95 ≤ 30 мин |
| Конверсия входящих → заявка | 0% | ≥ 40% |
| Демо-сценарий менеджера | ~2 мин | ≤ 90 сек |

---

## 13. Файлы для изменения (шпаргалка)

### Frontend

| Файл | Назначение |
|------|------------|
| `frontend/src/config/dashboardNav.ts` | `managerNavItems`, quick actions |
| `frontend/src/app/router.tsx` | роут `ai-quality` |
| `frontend/src/pages/manager/ManagerWorkDeskPage.tsx` | очередь, воронка, KPI, drawer записей |
| `frontend/src/pages/manager/ManagerRequestsPage.tsx` | фильтры, kanban, bulk |
| `frontend/src/pages/manager/ManagerRequestDetailPage.tsx` | 5 вкладок, picker, вложения |
| `frontend/src/pages/manager/ManagerCalendarPage.tsx` | drawer, фильтры |
| `frontend/src/pages/manager/ManagerClientsPage.tsx` | master-detail, гости, LTV |
| `frontend/src/pages/manager/ManagerContactsPage.tsx` | workflow, source, консультация |
| `frontend/src/pages/manager/ManagerAiQualityPage.tsx` | метрики, inline feedback |
| `frontend/src/components/manager/ManagerPicker.tsx` | выбор менеджера |
| `frontend/src/components/manager/BulkActionBar.tsx` | bulk + picker |
| `frontend/src/components/manager/InlineFeedbackQueue.tsx` | быстрая оценка ИИ |
| `frontend/src/components/requests/PriorityQueueList.tsx` | очередь на столе |
| `frontend/src/components/requests/ManagerKanban.tsx` | DnD канбан |
| `frontend/src/components/requests/BookingDrawer.tsx` | drawer записи |
| `frontend/src/components/requests/RequestSummaryPanel.tsx` | сводка заявки |
| `frontend/src/components/requests/MessageAttachmentInput.tsx` | загрузка вложений |
| `frontend/src/components/requests/MessageAttachmentList.tsx` | отображение вложений |
| `frontend/src/components/consultation/ConsultationPhotoGallery.tsx` | фото vision |
| `frontend/src/components/consultation/ConsultationStagesTimeline.tsx` | этапы ИИ |
| `frontend/src/components/analytics/CategoryBarChart.tsx` | bar chart ошибок |
| `frontend/src/lib/managerRequestHelpers.ts` | SLA, urgency, feedback helpers |
| `frontend/src/lib/savedQueueFilters.ts` | сохранённые фильтры очереди |
| `frontend/src/hooks/useDashboardPolling.ts` | polling 60 с |

### Backend

| Файл | Назначение |
|------|------------|
| `backend/prisma/schema.prisma` | модели manager ops + attachments |
| `backend/src/modules/serviceRequests/*` | SLA, activity, dossier, filters, assign |
| `backend/src/modules/requestMessages/*` | переписка + вложения |
| `backend/src/modules/analytics/*` | `manager-kpi` |
| `backend/src/modules/contact/*` | workflow + `source` |
| `backend/src/modules/integrations/integrations.router.js` | `GET /manager/integrations` |
| `backend/src/lib/requestMessageAttachments.js` | storage вложений |
| `backend/src/jobs/slaEscalation.job.js` | Telegram SLA |

---

## 14. Что НЕ делать

| Идея | Почему |
|------|--------|
| Дублировать админку в менеджере | Разделение ролей: менеджер = операции, админ = настройки |
| 10+ вкладок в карточке заявки | Cognitive overload; сводка = 80% |
| Real-time WebSocket | Реализован polling 60 с; WS — отдельная задача при необходимости |
| Свой дизайн вне токенов | Использовать существующие `Card`, `AnalyticsMetricCard`, `StatusBadge` |
| Big bang релиз | Фазы A → B → C, каждая проходит демо |

---

## Журнал прогресса

| Дата | Что сделано | Фаза |
|------|-------------|------|
| 2026-07-30 | Фаза A: сводка заявки, очередь «Сделать сейчас», качество ИИ, навигация | A |
| 2026-07-30 | Фаза B: workflow входящих, DnD канбан, SLA, гостевое досье, шаблоны, drawer календаря | B |
| 2026-07-30 | Фаза C: воронка, activity feed, bulk, LTV, похожие кейсы, SLA Telegram, polling 60 с | C |
| 2026-07-30 | Полировка: фильтры очереди, saved filters, status audit, booking ARRIVED/NO_SHOW, CRM bulk | D |
| 2026-07-30 | Финал: picker менеджера, вложения в переписке, `ContactSubmission.source`, docs sync | D |

---

## Заметки и решения

- **Приоритет:** Фаза A → B → C → D — все закрыты
- **Design system:** ui-ux-pro-max, dense dashboard
- **Feedback:** быстрые кнопки на сводке + `InlineFeedbackQueue` на «Качество ИИ» + полная форма в «Работы и оценка»
- **Назначение:** `assign-to-me` сохранён; picker через `PATCH /assign-manager` и `bulk/assign` с `managerId`
- **Вложения:** JPG/PNG/WEBP/GIF/PDF до 4 МБ, до 5 файлов; volume `uploads_data` в Docker
- **Источники входящих:** `contact_form` (default), `about_page` (форма на `/about`)
- **Связь с ИИ-roadmap:** замыкание контура feedback — [ai-improvement-roadmap.md](./ai-improvement-roadmap.md) фаза 2
