# Аудит проекта Fox Motors (AI Auto Service)

**Дата аудита:** 06.04.2026  
**Объект:** монорепозиторий `car-service-ai-assistant` (Express + Prisma + PostgreSQL, статический фронтенд, Ollama).

## Краткий вывод

Проект в зрелом состоянии для учебного/демо-продакшена: есть RBAC, rate limiting, Helmet, CSRF для состояний с cookie-сессией, refresh-токены в БД, валидация Zod, тесты Jest (включая безопасность), CI на GitHub Actions. Добавлены гостевая запись на сервис, форма контактов, аудит изменений бронирований, экспорт PDF. Основные оставшиеся риски — операционные (бэкапы, APM, E2E в CI) и синхронизация OpenAPI с фактическим API.

## Методология

- Просмотр `backend/src` (маршруты, middleware, сервисы), `prisma/schema.prisma`, миграций.  
- Сверка с `docs/*`, `README.md`, `.github/workflows/ci.yml`.  
- Без динамического пентеста и без полного анализа зависимостей за пределами `npm audit` в CI.

## Сильные стороны

| Область | Что сделано |
|--------|-------------|
| Аутентификация | Access/refresh JWT в httpOnly-cookie (`fm_at`, `fm_rt`), refresh хранится как хеш в `refresh_tokens`. |
| CSRF | Double-submit: cookie `fm_csrf` + заголовок `X-CSRF-Token` для мутаций при наличии auth-cookie; в `test` отключено. |
| Авторизация | RBAC (`CLIENT` / `MANAGER` / `ADMINISTRATOR`), отдельные правила доступа к консультациям (владелец / гость / менеджер). |
| Валидация | Zod на телах запросов и query; окно записи 09:00–21:00 МСК на уровне сервиса бронирований. |
| Пароли | bcrypt; политика регистрации: ≥8 символов, латиница + цифра, без кириллицы (`passwordPolicy.js`). |
| БД | Prisma, индексы на горячих полях, миграции версионируются. |
| Наблюдаемость кода | Pino + `pino-http` (кроме `NODE_ENV=test`). |
| HTTP | Helmet, CORS с `credentials`, в production задание `CORS_ORIGIN` обязательно (Zod). |
| Тесты | Unit + integration + `security.test.js`; CI: lint, `npm audit --omit=dev --audit-level=high`, `prisma migrate deploy`, `npm test`. |
| Продуктовые фичи | SSE-консультация, гостевые сценарии, PDF-экспорт консультации и заявки, контактная форма, аудит бронирований. |

## Риски и пробелы

| # | Тема | Серьёзность | Комментарий |
|---|------|-------------|-------------|
| 1 | E2E в CI | Средняя | Playwright не входит в workflow; регрессии UI не ловятся автоматически. |
| 2 | LLM на Render | Ожидаемо | Без Ollama консультации дают 503 — документировано в deployment. |
| 3 | SSRF к `LLM_BASE_URL` | Низкая–средняя | URL задаётся окружением; в публичном деплое не проксировать произвольные хосты. |
| 4 | OpenAPI | Низкая | `specs/.../openapi.yaml` может отставать от живых маршрутов; при изменении API стоит обновлять контракт. |
| 5 | APM / алерты | Средняя | Нет Sentry/аналога; ошибки только в логах. |
| 6 | Бэкапы БД | Средняя | Не в репозитории; для продакшена нужен `pg_dump`/managed backups. |
| 7 | Шрифты PDF на Linux | Низкая | Нужен TTF с кириллицей или `PDF_BODY_FONT` (см. `env-variables.md`). |

## Рекомендации (приоритизировано)

1. **High:** добавить job Playwright в GitHub Actions с `LLM_ENABLED=false` и поднятой PostgreSQL service (как в job `test`), либо мок Ollama.  
2. **Medium:** внешний health-check на `GET /api/health` (UptimeRobot, Checkly).  
3. **Medium:** подключить Sentry или аналог для backend.  
4. **Medium:** политика бэкапов для PostgreSQL.  
5. **Low:** contract-тесты на формат JSON от Ollama (извлечение / диагностика).  
6. **Low:** pre-commit (husky + lint-staged) по желанию команды.  
7. **Low:** soft delete / GDPR — при появлении требований к удалению персональных данных.

## Соответствие прошлым замечаниям

- Парольная политика и тесты к ней — **реализованы**.  
- Refresh-токены, CSRF, гостевые брони, контакты, аудит бронирований — **в коде и миграциях**.  
- Задачи из списка «ручная настройка» (Sentry, бэкапы, E2E в CI) — **по-прежнему вне кода**.
