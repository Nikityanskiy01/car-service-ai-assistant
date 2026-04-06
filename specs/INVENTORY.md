# Inventory: страницы, роли и основные потоки

Дата: 2026-03-25 (инвентарь обновлён 2026-04-06)

Цель: иметь единый список страниц/эндпоинтов/сценариев, чтобы системно улучшать дизайн, контент и UX без пропусков.

## Frontend (страницы)

### Публичные

- `frontend/index.html` — главная (CTA: консультация / контакты / вход / регистрация).
- `frontend/consult.html` — ИИ‑консультация (чат + сайдбар + режим результата).
- `frontend/about.html` — о сервисе / как работает.
- `frontend/works.html` — примеры работ / направления.
- `frontend/gallery.html` — галерея (пока заглушки).
- `frontend/location.html` — контакты + карта (форма → `POST /api/contact`).
- `frontend/services.html` — каталог услуг.
- `frontend/book-service.html` — запись на сервис без аккаунта (`POST /api/bookings/guest`).
- `frontend/login.html` — вход.
- `frontend/register.html` — регистрация.

### Кабинеты (по ролям)

- `frontend/dashboards/client.html` — кабинет клиента (профиль, консультации, заявки, отчёты, записи).
- `frontend/dashboards/manager.html` — кабинет менеджера (список заявок, детали, переписка, записи).
- `frontend/dashboards/admin.html` — админка (сводка, пользователи, справочники/сценарии).

## Backend (API: маршруты)

- `backend/src/routes/api.js`
  - `GET /api/health`, глобальный CSRF для мутаций при auth-cookie.
- `backend/src/modules/auth/auth.router.js`
  - Регистрация/логин/refresh/logout (JWT в httpOnly-cookie + CSRF cookie).
- `backend/src/modules/contact/contact.router.js`
  - Публичная отправка контактов; список для MANAGER/ADMINISTRATOR.
- `backend/src/modules/users/users.router.js`
  - Профиль (`/users/me`).
- `backend/src/modules/consultations/consultations.router.js`
  - Сессии консультаций, сообщения, SSE, список для staff, PDF `export.pdf`, создание заявки гостем, claim.
- `backend/src/modules/serviceRequests/serviceRequests.router.js`
  - Заявки в сервис (список/детали/обновления, PDF `export.pdf`).
- `backend/src/modules/requestMessages/requestMessages.router.js`
  - Переписка по заявке.
- `backend/src/modules/bookings/bookings.router.js`
  - Записи на визит (гость `POST /guest`, клиент, список, PATCH, аудит для админа).
- `backend/src/modules/analytics/analytics.router.js`
  - Сводка/аналитика.
- `backend/src/modules/admin/admin.router.js`
  - Управление пользователями и справочниками.

## Ключевые UX‑потоки (то, что обязаны “прогнать”)

### Гость → консультация → заявка

1. Открыть `consult.html` как гость.
2. Пройти диалог до состояния “готово”.
3. Нажать “Создать заявку” → ввести имя/телефон → заявка создаётся.
4. Проверить: понятные подсказки, нет “галлюцинаций” в итогах, стоимость/уверенность показываются только при реальных симптомах.

### Гость → регистрация/логин → привязка (claim)

1. После гостевой заявки зарегистрироваться / войти.
2. В кабинете клиента проверить: прошлые гостевые сессии/заявки привязались к аккаунту.

### Клиент → кабинет → история консультаций/заявок

1. Открыть `dashboards/client.html`.
2. Проверить вкладки: консультации/заявки/отчёты/записи.
3. Открыть детали консультации и заявки: читабельность, пустые состояния, CTA.

### Менеджер → обработка заявки → ответ клиенту

1. Открыть `dashboards/manager.html`.
2. Фильтры работают, список кликабелен.
3. В деталях видно контакты (клиент или гость), можно написать сообщение.

### Админ → справочники/пользователи

1. Открыть `dashboards/admin.html`.
2. Список пользователей, смена роли/блок.
3. Создание категории/сценария: успешные состояния и ошибки.

## Что ещё добавить (когда появятся данные)

- Фото/реальные контакты на `gallery.html` и `location.html`.
- Реальные цены/статистика работ (если не хотим хранить исходный `.xlsx` в репо — вынести в приват/ignored).

