# Продукт и роли

Три роли с жёстким RBAC. Публичный сайт доступен без входа; консультацию и заявку может оформить гость.

## Публичный сайт

| URL | Страница |
|-----|----------|
| `/` | Главная: hero, услуги, вход в диагностику |
| `/services` | Услуги |
| `/works` | Примеры работ |
| `/gallery` | Галерея |
| `/about` | О сервисе, контакты, карта |
| `/consult` | ИИ-консультация (чат) |
| `/booking` | Запись на сервис |
| `/privacy`, `/terms` | Юридические страницы |
| `/login`, `/register` | Вход и регистрация |
| `/forgot-password`, `/reset-password`, `/verify-email` | Почта и восстановление |

Контент и оформление (название, цвета, реквизиты) задаются в админке и отдаются через `GET /api/content/site-settings`.

## Клиент — «центр обслуживания авто»

Стартовый экран: `/dashboard/client`. Принцип: на каждом экране понятно, **что делать дальше**.

| Раздел | URL |
|--------|-----|
| Обзор | `/dashboard/client` |
| Мои обращения | `/dashboard/client/cases` |
| Карточка обращения | `/dashboard/client/cases/:id` |
| Записи | `/dashboard/client/bookings` |
| Карточка записи | `/dashboard/client/bookings/:id` |
| Гараж | `/dashboard/client/vehicles` |
| Профиль | `/dashboard/client/profile` |
| ИИ-диагностика | `/consult` |

Обращение (Case) склеивает консультацию, заявку, переписку и запись. Авторизованный клиент пишет запись сразу в «Мои записи»; гостевая консультация после входа claim-ится на аккаунт.

На мобилке — нижняя навигация: Обзор / Обращения / Записи / Ещё.

## Менеджер — операционный приёмщик

Не «админ lite»: очередь заявок после ИИ → визит → ответ клиенту → оценка диагноза.

| Раздел | URL |
|--------|-----|
| Рабочий стол | `/dashboard/manager` |
| Очередь (список / канбан) | `/dashboard/manager/requests` |
| Карточка заявки | `/dashboard/manager/requests/:id` |
| Календарь | `/dashboard/manager/calendar` |
| Клиенты | `/dashboard/manager/clients` |
| Входящие с сайта | `/dashboard/manager/contacts` |
| Качество ИИ | `/dashboard/manager/ai-quality` |
| Профиль | `/dashboard/manager/profile` |

Карточка заявки — пять вкладок: сводка (быстрая оценка ИИ), диалог консультации, переписка, работы и оценка, история/CRM.

Статусы заявки: New → In progress → Scheduled → Completed / Cancelled.

## Администратор — пульт сервиса

Семь зон в сайдбаре. Операционные экраны переиспользуют страницы менеджера с флагом `adminZone`.

| Зона | URL |
|------|-----|
| Пульт | `/dashboard/admin` |
| Аналитика | `/dashboard/admin/analytics` |
| Операции → Заявки | `/dashboard/admin/operations/requests` |
| Операции → Записи | `/dashboard/admin/operations/bookings` |
| Операции → Клиенты | `/dashboard/admin/operations/clients` |
| Операции → Обращения | `/dashboard/admin/operations/contacts` |
| Команда → Пользователи | `/dashboard/admin/team/users` |
| Команда → Активность | `/dashboard/admin/team/activity` |
| ИИ → Статус | `/dashboard/admin/ai/status` |
| ИИ → Сценарии | `/dashboard/admin/ai/scenarios` |
| ИИ → Справочники | `/dashboard/admin/ai/reference` |
| ИИ → Память кейсов | `/dashboard/admin/ai/memory` |
| ИИ → Обратная связь | `/dashboard/admin/ai/feedback` |
| Сайт → Контент | `/dashboard/admin/site/items` |
| Сайт → Блоки | `/dashboard/admin/site/blocks` |
| Сайт → Оформление | `/dashboard/admin/site/appearance` |
| Сайт → Юр. данные | `/dashboard/admin/site/legal` |
| Интеграции | `/dashboard/admin/integrations` |
| Интеграции → Очередь | `/dashboard/admin/integrations/jobs` |
| Интеграции → Конфликты | `/dashboard/admin/integrations/conflicts` |
| Безопасность → Журнал | `/dashboard/admin/security/audit` |

На пульте: Status Strip (ИИ · CRM · очередь), Action Inbox, KPI. `Ctrl+K` — переход по разделам.

## Интеграции и уведомления

- CRM/1С и аналоги — подключения, джобы, inbox конфликтов.
- Telegram — уведомление менеджеру о новой заявке (если заданы `TELEGRAM_*`).
- SMTP — сброс пароля и верификация почты (на демо — Mailpit).

## Дизайн-система

Токены и правила лендинга: `design-system/autoservice-ai/`. Шрифты: Manrope + Source Sans 3, акцент navy/blue (не Inter и не фиолетовый SaaS-градиент).
