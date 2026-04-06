# Архитектура проекта

## Стек

- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Frontend**: статический HTML/CSS/vanilla JS (раздаётся Express)
- **LLM**: Ollama (Qwen 2.5 7B) — native API с structured output
- **Уведомления**: Telegram Bot API
- **Тесты**: Jest (unit/integration), Playwright (E2E), k6 (нагрузка)

## Дерево файлов

```
car-service-ai-assistant/
│
├── docker-compose.yml          # PostgreSQL + Ollama контейнеры
├── playwright.config.js        # конфигурация E2E-тестов
├── render.yaml                 # Render.com деплой (backend + frontend + DB)
├── package.json                # корневой — только devDependencies для Playwright
│
├── .github/workflows/          # CI: ESLint, npm audit, Jest + Prisma migrate
├── docs/                       # документация проекта (вы здесь)
│   ├── setup.md                # установка и запуск
│   ├── architecture.md         # архитектура и дерево файлов
│   ├── ai-integration.md       # интеграция с LLM
│   ├── api.md                  # REST API эндпоинты
│   ├── database.md             # схема БД
│   ├── env-variables.md        # переменные окружения
│   ├── testing.md              # тестирование
│   ├── scripts.md              # npm-скрипты
│   ├── deployment.md           # Docker / Render / VPS
│   └── audit-report.md         # отчёт аудита
│
├── backend/
│   ├── .env / .env.example     # конфигурация окружения
│   ├── package.json            # зависимости и скрипты backend
│   ├── eslint.config.js        # линтер
│   ├── jest.config.js          # конфигурация Jest
│   │
│   ├── prisma/
│   │   ├── schema.prisma       # схема БД (модели, enum, связи)
│   │   ├── seed.js             # начальные данные (пользователи, категории)
│   │   └── migrations/         # SQL-миграции (применяются через prisma migrate)
│   │
│   ├── data/
│   │   ├── price_catalog.json  # каталог цен на работы (используется в pricing.js)
│   │   └── work_stats.json     # статистика частых работ по категориям (для LLM-промптов)
│   │
│   ├── scripts/
│   │   ├── db-setup.mjs        # npm run db:setup — миграции + seed одной командой
│   │   ├── ensure-test-database.mjs  # создание тестовой БД
│   │   ├── llm-check.js        # npm run llm:check — проверка доступности Ollama
│   │   ├── smoke-consultation.js     # дымовой тест консультации через API
│   │   ├── build-price-catalog.js    # генерация price_catalog.json
│   │   └── build-work-stats.js       # генерация work_stats.json
│   │
│   ├── src/
│   │   ├── app.js              # Express-приложение (middleware, маршруты, статика)
│   │   ├── server.js           # запуск HTTP-сервера
│   │   │
│   │   ├── config/
│   │   │   ├── env.js                        # Zod-валидация переменных окружения
│   │   │   ├── apiMessages.js                # локализованные сообщения об ошибках
│   │   │   └── consultationFlow.config.js    # тексты вопросов, альтернативы, правила категорий
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.js              # singleton Prisma Client
│   │   │   ├── errors.js              # AppError — HTTP-ошибки с кодом
│   │   │   ├── logger.js              # Pino логгер
│   │   │   ├── authCookies.js         # имена cookie JWT/CSRF, set/clear
│   │   │   ├── passwordPolicy.js      # политика пароля при регистрации (Zod)
│   │   │   ├── bookingHours.js        # допустимое окно записи (МСК)
│   │   │   ├── pdfCyrillicFont.js     # выбор TTF для PDFKit
│   │   │   ├── pdf/                   # PDFKit: макет, консультация, заявка
│   │   │   ├── consultationProgress.js # расчёт прогресса консультации
│   │   │   ├── diagnosticPlaybooks.js  # плейбуки мастера (гипотезы, проверки по симптомам)
│   │   │   ├── pricing.js             # оценка стоимости по каталогу
│   │   │   └── workStats.js           # статистика работ из work_stats.json
│   │   │
│   │   ├── middleware/
│   │   │   ├── authJwt.js             # JWT-аутентификация (authJwt, optionalAuthJwt)
│   │   │   ├── requireRole.js         # RBAC — проверка роли
│   │   │   ├── consultationAccess.js  # доступ к сессии (владелец / гость / менеджер)
│   │   │   ├── csrf.js                # CSRF double-submit при auth-cookie
│   │   │   ├── validate.js            # Zod-валидация тела запроса
│   │   │   ├── asyncHandler.js        # обёртка для async-ошибок в Express
│   │   │   └── errorHandler.js        # глобальный обработчик ошибок
│   │   │
│   │   ├── prompts/
│   │   │   └── consultationPrompts.js  # system-промпты + JSON Schema для LLM
│   │   │
│   │   ├── routes/
│   │   │   └── api.js                 # маршрутизатор /api — монтирует все модули
│   │   │
│   │   ├── services/
│   │   │   ├── ollamaService.js            # HTTP-клиент Ollama native API
│   │   │   ├── consultationFlowService.js  # state machine консультации + LLM extraction
│   │   │   ├── consultationIntent.service.js  # определение intent (diagnostic / service)
│   │   │   ├── caseMemory.service.js       # поиск похожих завершённых кейсов
│   │   │   └── symptomClassifier.js        # классификация симптомов по категориям
│   │   │
│   │   ├── utils/
│   │   │   └── safeJsonParse.js       # устойчивый парсер JSON (fallback)
│   │   │
│   │   └── modules/                   # бизнес-модули (router + service)
│   │       ├── auth/                  # регистрация, вход, JWT, cookie, refresh
│   │       ├── contact/               # публичная форма контактов + список для staff
│   │       ├── consultations/         # сессии, сообщения, AI-диагностика, отчёты, PDF
│   │       ├── serviceRequests/       # заявки в сервис, PDF
│   │       ├── requestMessages/       # переписка по заявке (клиент ↔ менеджер)
│   │       ├── bookings/             # бронирование времени
│   │       ├── admin/                # управление контентом, пользователями
│   │       ├── analytics/            # статистика для дашборда
│   │       ├── notifications/        # Telegram-уведомления
│   │       ├── reference/            # справочные материалы, шаблоны сценариев
│   │       └── users/                # профиль, список пользователей
│   │
│   └── tests/
│       ├── setup.js / global-setup.js / helpers.js
│       ├── unit/                      # flow, progress, booking-hours, password-policy, contact-phone
│       ├── integration/               # auth, consultation, RBAC, заявки, брони, контакты, Telegram…
│       └── security/                  # тесты безопасности
│
├── frontend/
│   ├── index.html              # главная страница
│   ├── consult.html            # страница ИИ-консультации
│   ├── about.html              # о сервисе
│   ├── works.html              # виды работ
│   ├── gallery.html            # галерея
│   ├── location.html           # контакты и карта
│   ├── services.html           # услуги (каталог)
│   ├── book-service.html       # запись на сервис (в т.ч. гость)
│   ├── login.html              # вход
│   ├── register.html           # регистрация
│   ├── 403.html / 404.html / 500.html  # страницы ошибок
│   ├── build.mjs               # сборка для production (копирование в dist/)
│   ├── package.json            # скрипт build
│   │
│   ├── assets/
│   │   └── logo.svg
│   │
│   ├── css/
│   │   ├── tokens.css          # CSS-переменные (цвета, шрифты, отступы)
│   │   ├── base.css            # сброс + базовые стили
│   │   ├── layout.css          # сетка, контейнер
│   │   ├── components.css      # карточки, кнопки, формы, чат-баблы, прогресс
│   │   ├── utilities.css       # утилитарные классы
│   │   └── pages/              # стили по страницам (home, consult, dashboard, auth...)
│   │
│   ├── js/
│   │   ├── api.js              # HTTP-клиент (/api), JWT, ошибки
│   │   ├── utils.js            # $(), escapeHtml, formatDate
│   │   ├── layout.js           # header/footer, навигация, роль пользователя
│   │   ├── auth.js             # логин/регистрация (формы)
│   │   ├── consult.js          # ИИ-консультация (SSE, чат, результат, заявки)
│   │   ├── consultStorage.js   # локальное сохранение черновика консультации
│   │   ├── booking-hours.js    # подсказки по окну записи (МСК)
│   │   ├── phone.js            # нормализация/валидация телефона
│   │   ├── services-page.js    # логика services.html
│   │   ├── gallery.js          # галерея
│   │   ├── location.js         # карта, отправка формы контактов
│   │   ├── works.js            # виды работ
│   │   ├── router-guard.js     # редирект по ролям
│   │   ├── entry/              # точки входа для отдельных страниц (при сборке)
│   │   ├── dashboards/
│   │   │   ├── client.js       # личный кабинет клиента
│   │   │   ├── manager.js      # дашборд менеджера
│   │   │   ├── admin.js        # панель администратора
│   │   │   ├── booking-staff-ui.js, staff-dashboard-ops.js
│   │   │   ├── service-requests-kanban.js, staff-work-calendar.js
│   │   └── ui/
│   │       └── dialogs.js      # модальные окна, prompt контактов
│   │
│   └── dashboards/
│       ├── client.html         # ЛК клиента
│       ├── manager.html        # дашборд менеджера
│       └── admin.html          # панель администратора
│
├── specs/                      # спецификации и планирование
│   ├── INVENTORY.md            # реестр страниц, API, UX-потоков
│   ├── usability/README.md     # сценарии юзабилити, эвристики
│   └── 001-ai-consultation-platform/
│       ├── spec.md             # спецификация (FR, TR, AC, user stories)
│       ├── plan.md             # план реализации
│       ├── tasks.md            # чеклист задач T001–T064
│       ├── data-model.md       # модель данных
│       ├── research.md         # исследование технологий
│       ├── quickstart.md       # краткий старт
│       ├── contracts/
│       │   └── openapi.yaml    # OpenAPI 3.0.3 контракт REST API
│       └── checklists/
│           ├── requirements.md             # чеклист требований
│           └── vkr-kontrol-trebovaniy.md   # контроль требований ВКР
│
├── tests/
│   ├── e2e/                    # Playwright E2E-тесты
│   │   ├── us1-client-consultation.spec.js  # сценарий клиента
│   │   ├── us2-manager-dashboard.spec.js    # сценарий менеджера
│   │   ├── us4-consult-layout.spec.js       # вёрстка консультации
│   │   └── us4-public-pages.spec.js         # публичные страницы
│   └── perf/
│       └── k6-consultation.js  # нагрузочный тест (k6)
│
└── docker/
    └── postgres-init/
        └── 01-create-test-db.sql  # автосоздание тестовой БД при старте контейнера
```
