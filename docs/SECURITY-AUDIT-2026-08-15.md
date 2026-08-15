# Повторный аудит безопасности: интеллектуальный ассистент автосервиса

| Поле | Значение |
|---|---|
| Дата | 15 августа 2026 (повторное ревью вечером) |
| Объект | Весь репозиторий `car-service-ai-assistant` (backend, frontend, Docker, nginx, CI, Prisma, LLM-контур) |
| Тип | Комплексный аудит исходного кода и конфигурации (SAST / config review), плюс `npm audit` |
| База | Первичный отчёт того же дня (спринты 1–4 помечены закрытыми). Этот файл **заменяет** утреннюю версию: статусы перепроверены по коду, добавлены новые находки |
| Не входило | Внешний пентест, DAST, проверка живых TLS-сертификатов edge-прокси, социальная инженерия, физический доступ, сила секретов на сервере |
| Стандарты | OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 4.0.3 (целевой уровень L2), OWASP LLM Top 10:2025, CWE Top 25, CIS Docker Benchmark, NIST SSDF, NIST SP 800-63B, 152-ФЗ |
| Вердикт | Для публичного демо — **приемлемо**. Для обработки реальных ПДн как production — **ещё не готов по оргконтуру 152-ФЗ** (поручение, уведомление РКН). Кодовый HIGH H-10 закрыт в спринте 5: wipe ПДн, обязательные криптоключи, metrics/PoW/lockout |

Секреты из `.env` / `.env.proxmox` в отчёт **не включались**. Проверялись только шаблоны, код и то, что закоммичено в репозиторий.

---

## 1. Резюме для руководства

Спринты 1–4 из утреннего аудита **в коде действительно закрыты**: OTP больше не выдаёт JWT-пустышку, backup-коды 80 бит, OTP/guestToken на HMAC, Redis с паролем, nodemailer 9.0.5, LLM-квоты, magic bytes, DNS-SSRF, refresh reuse, lockout, consent/export/delete API, HSTS/CSP/security.txt, pin образов, CodeQL/TruffleHog/SBOM.

Оборонительный фундамент сохранён: httpOnly + `__Host-` cookie в production, CSRF double-submit, RBAC, Helmet, Zod, Prisma, HMAC вебхуков, AES-256-GCM секретов интеграций, TOTP, защита последнего администратора.

**Итоговая оценка зрелости:** 9.2 / 10 (утро 5.5 → … → спринт 7: 9.0 → спринт 8). Кодовый реестр H/M/L аудита закрыт. До production с ПДн — оргмеры 152-ФЗ и пентест.

| Критичность | Открыто сейчас | Было после спринта 7 | Изменение |
|---|---|---|---|
| Critical | 0 | 0 | — |
| High | 0 | 0 | — |
| Medium | 0 | 0 | — |
| Low | 0 | 6 | −6 |
| **Всего открытых** | **0** | **6** | спринт 8 |

`npm audit --omit=dev`: backend **0**, frontend **0**. С devDependencies backend: **2 HIGH** (`brace-expansion` / `js-yaml` в nodemon/istanbul). `xlsx` из devDependencies **убран**.

---

## 2. Что сделано хорошо (сохранить)

| Область | Контроль | Где |
|---|---|---|
| Сессии | Access JWT 30 мин + refresh 7 дней; в production `__Host-` + `Secure` + `SameSite=Lax`; refresh SHA-256; ротация + **reuse → revoke family + tokenVersion** | `authCookies.js`, `auth.service.js` |
| JWT | `algorithms: ['HS256']`, роль из БД, `tokenVersion`, `iss`/`aud` | `jwtTokens.js`, `authJwt.js` |
| Пароли | bcrypt 12, политика 12+ mixed, dummy hash на login | `passwordPolicy.js`, `auth.service.js` |
| 2FA | TOTP AES-256-GCM, backup 80 bit + HMAC, staff `stp=1` до confirm | `totp.js`, `authJwt.js` |
| OTP | Dummy = `randomBytes(32).base64url`; hint от ввода; cooldown без 429 | `otpChallenge.js`, `otpLogin.service.js` |
| CSRF | Double-submit, timing-safe | `csrf.js` |
| Guest | HMAC в БД, plaintext только в ответе create | `guestToken.js` |
| Lockout | 5 неудач / 15 мин | `accountLockout.js` |
| RBAC / IDOR | Клиент видит только своё; staff не пишет в чат консультации | роутеры, `consultationAccess.js` |
| Валидация | Zod, JSON 1 МБ | `validate.js`, `app.js` |
| Инъекции | Prisma; `$queryRaw` — tagged template с `userId` | `requestMessages.service.js` |
| Заголовки | Helmet CSP, nginx HSTS / nosniff / CSP `style-src 'self'` / `img-src 'self' data:` | `app.js`, `frontend/docker/default.conf` |
| Rate limit | 300/15 мин на `/api` через Redis store; LLM 8 / vision 2 | `rateLimitConfig.js` |
| LLM abuse | PoW на create session, квота 20 USER-сообщений гостя | `guestPow.js`, `llmQuota.js` |
| Вебхуки | HMAC-SHA256, timing-safe | `webhookHmac.js` |
| Секреты интеграций | AES-256-GCM, `INTEGRATION_ENCRYPTION_KEY` обязателен в production | `env.js` |
| SSRF | Private IP + DNS lookup + запрет absolute join; fetch `redirect: 'error'` | `safeOutboundUrl.js`, `genericRest.adapter.js` |
| Файлы | Magic bytes, JPEG re-encode/EXIF strip, PDF как `attachment` | `fileMagic.js`, `imageSanitize.js` |
| Privacy API | `consent_events`, `/api/users/me/privacy/export\|delete`, TTL гостевых сессий 24 ч | `privacy.service.js`, `guestSessionTtl.job.js` |
| Docker | digest pin postgres/redis/mailpit/node/nginx; frontend `read_only` + `cap_drop ALL`; Redis `--requirepass` | `docker-compose.yml` |
| CI | `npm audit --omit=dev --audit-level=high`, CodeQL, TruffleHog verified, SBOM, Trivy fs, pin SHA actions, Dependabot | `.github/workflows/ci.yml` |
| Письма | `escapeHtml` во всех HTML-шаблонах | `mail.service.js` |
| Тесты | `backend/tests/security/` (sprint + hardening + baseline) | |

---

## 3. Перепроверка утреннего реестра

Нумерация `H-xx` / `M-xx` / `L-xx` сохранена. Статус: **закрыто** / **частично** / **открыто**.

### 3.1. High (утро)

| ID | Утро | Сейчас | Доказательство |
|---|---|---|---|
| H-01 OTP enum через JWT vs random | High | **Закрыто** | `dummyOtpToken()` = `randomBytes(32).base64url`; cooldown возвращает dummy, не 429 |
| H-02 Backup 32 бита | High | **Закрыто** | `randomBytes(10)` → 80 bit hex-группы + HMAC |
| H-03 Unsalted SHA-256 OTP | High | **Закрыто** | `hmacHex('otp', …)` + `timingSafeEqual`; legacy SHA-256 dual-verify оставлен сознательно |
| H-04 Публичный LLM без квоты | High | **Закрыто** | `createLlmLimiter` 8/15 мин, vision 2, PoW на create + messages/SSE/photo, квота 20 |
| H-05 Redis без AUTH | High | **Закрыто** (остаток → M-21) | `--requirepass ${REDIS_PASSWORD}`, `REDIS_URL` с паролем |
| H-06 nodemailer HIGH CVE | High | **Закрыто** | `nodemailer@9.0.5`; prod audit 0 |
| H-07 guestToken plaintext | High | **Закрыто** | HMAC в БД; plaintext compare убран (L-18) |
| H-08 152-ФЗ / ПДн в LLM | High | **Частично → H-10 → закрыто в коде (спринт 5)** | Wipe сообщений/эмбеддингов/VIN; consent больше не глотается; TTL гостя с заявкой анонимизирует ФИО/телефон. Юридический контур (поручение, РКН) вне репо |
| H-09 Демо-пароли в git | High | **Закрыто** | Production и non-prod seed требуют `DEMO_*_PASSWORD`; CI e2e прокидывает те же env |

### 3.2. Medium (утро)

| ID | Сейчас |
|---|---|
| M-01 Magic bytes | **Закрыто** (PNG/WebP/GIF не ре-энкодятся → M-40) |
| M-02 SSRF без DNS | **Закрыто** (спринт 5): `fetchSafeOutbound` pin IP + SNI/Host; NAT64 в блок-листе |
| M-03 Absolute joinSafeUrl | **Закрыто** |
| M-04 Refresh reuse | **Закрыто** (`consumedAt` + family + `tokenVersion`) |
| M-05 TOTP из JWT | **Закрыто**: `TOTP_ENCRYPTION_KEY` + `HMAC_PEPPER` обязательны в production; dual-read HMAC на pepper+JWT |
| M-06 Нет lockout | **Закрыто** (побочный enum → M-25: lockout теперь 401, `EMAIL_NOT_VERIFIED` оставлен для UX) |
| M-07 Кэш auth 45 с | **Закрыто** (TTL 5 с) |
| M-08 HSTS демо | **Закрыто** в контейнерном nginx и `autoservice-demo.conf`; edge не проверялся |
| M-09 Mailpit в default compose | **Закрыто** (`profiles: [mail]`); SMTP_SECURE=false → M-37 |
| M-10 Image digest | **Закрыто** |
| M-11 CI security-gate | **Частично**: Trivy CRITICAL валит CI; HIGH — отчёт; xlsx в dev → L-27 |
| M-12 Prisma CLI в образе | **Закрыто** (`prisma` в `dependencies`) |
| M-13 HTML в письмах | **Закрыто** |
| M-14 CSP unsafe-inline / img https | **Закрыто** (контейнер + `car-service.conf` выровнены) |
| M-15 Телефон не уникален | **Закрыто** (partial unique index) |
| M-16 inline PDF | **Закрыто** (PDF `attachment`; картинки `inline`) |
| M-17 Rate limit в памяти | **Закрыто**: глобальный и auth-лимитеры через `createRateLimiter` / Redis |
| M-18 Few-shot в промпт | **Закрыто**: даже при флаге только verdict/vehicle/category |
| M-19/M-20 Delete/consent | **Закрыто** в коде: wipe ПДн + `CONSENT_FAILED` 503 |
| M-21 Docker sidecars | **Закрыто**: `cap_drop ALL` redis/mailpit; пароль Redis не в argv; db `no-new-privileges` |
| M-22 JWT iss/aud | **Закрыто** |
| M-23 EXIF/vision | **Закрыто** для JPEG; PNG/WebP — стрип чанков |
| M-24 Логи / request-id | **Закрыто**; phone/fullName в redact (спринт 7) |

### 3.3. Low (утро)

| ID | Сейчас |
|---|---|
| L-01 Health раскрывает db | **Закрыто**: `/api/health` и `/api/ready` без `db`/`redis` |
| L-02 Клиентский X-Request-Id | **Закрыто** (сервер генерирует UUID/traceId) |
| L-03 Нет `__Host-` | **Закрыто** в production |
| L-04 OTP не timing-safe | **Закрыто** |
| L-05 claim `!==` | **Закрыто** (`timingSafeEqual`) |
| L-06 Permissions-Policy | **Закрыто** (`payment`/`usb`/`interest-cohort`/`browsing-topics`) |
| L-07 Cache-Control API | **Закрыто** (`no-store` на `/api`) |
| L-08 CSP Helmet vs nginx | **Закрыто** (выровнены) |
| L-09 Профиль в localStorage | **Закрыто**: sessionStorage только `{ id, role }` |
| L-10 mailpit:latest | **Закрыто** |
| L-11 security.txt | **Закрыто** |
| L-12 SBOM/Dependabot | **Закрыто** |

---

## 4. Открытые находки (текущее состояние)

Нумерация сохранена. **Спринт 5 закрыл в коде:** H-10, M-05, M-27, M-30, M-32, M-21, M-29 (CRITICAL), M-41, M-42, M-43, L-13, L-14, L-29, L-30, L-31, L-32. Ниже — то, что ещё открыто или осталось как residual.

### 4.1. High

#### H-10. Уничтожение ПДн — **закрыто в коде (спринт 5)**

Сделано: wipe текстов сообщений (`[удалено]`), extracted symptoms/OBD, эмбеддингов, VIN/госномера, follow-up заявок, booking notes, login events; export отдаёт сообщения; `recordConsentEvent` → 503 `CONSENT_FAILED`; TTL гостя с заявкой обнуляет ФИО/телефон.

Сознательный остаток: tombstone-строка `users` (FK на заявки/консультации). Вне кода: локальный Ollama всё ещё видит симптомы в промпте; поручение обработчику / уведомление РКН в репозитории нет. Для демо риск низкий.

### 4.2. Medium — открытый остаток

#### M-25. `EMAIL_NOT_VERIFIED` — **закрыто (спринт 6)**

Login и `completeVerifiedLogin` на неподтверждённый email отвечают тем же 401 `UNAUTHORIZED`, что и неверный пароль. Resend-UX — статическая ссылка «Подтвердить email» на `/verify-email`, без сигнала от API.

#### M-26. PoW на LLM-сообщениях — **закрыто (спринт 7)**

Difficulty = 4 hex-нуля (16 бит) + одноразовый nonce (Redis SET NX). Challenge на create session **и** на `POST /messages`, `POST /messages/stream`, `POST /analyze-photo` для гостей. SSE — fetch POST с теми же заголовками (не EventSource), 403 до `text/event-stream`. Вошедшие клиенты по-прежнему пропускаются.

#### M-18. Few-shot менеджера — **закрыто (спринт 7)**

Default `CONSULTATION_FEEDBACK_FEW_SHOT_ENABLED=false` в production. Если флаг включить — в user-промпт идут только `verdict` / `vehicle` / `category`, без `actualCause` / `worksDone` / симптомов.

#### M-36. Демо-seed — **закрыто (спринт 7)**

`seed.js` и `seed.demo.js` требуют `DEMO_*_PASSWORD` всегда. CI e2e передаёт те же переменные; спеки читают их через `tests/e2e/credentials.js`.

Закрыто спринтом 6: M-25, M-37, M-38, M-40; L-19, L-20, L-27. Оргконтур: `docs/privacy-processing.md`.
Закрыто спринтом 7: M-18, M-26, M-36, L-01, L-24.

### 4.3. Low

| ID | Суть | Статус |
|---|---|---|
| L-01 | `/api/health` и `/api/ready` без `db`/`redis` | **закрыто** |
| L-06 | `Permissions-Policy`: payment, usb, interest-cohort, browsing-topics | **закрыто** |
| L-09 | Профиль: sessionStorage `{ id, role }`, без email/телефона | **закрыто** |
| L-13 | JSON-LD: escape `</` через `\\u003c` | **закрыто** |
| L-14 | path containment `resolveUploadPath` на read/delete uploads | **закрыто** |
| L-18 | `guestTokenMatches` только HMAC, без plaintext | **закрыто** |
| L-19 | `seed.demo` пишет HMAC guestToken; пароли не в логе | **закрыто** |
| L-20 | Seed bcrypt 12 | **закрыто** |
| L-24 | Redact логов: `phone`, `fullName`, `guestPhone`, `guestName` | **закрыто** |
| L-25 | HSTS `preload` в контейнерном nginx и шаблонах; edge должен пробрасывать заголовок | **закрыто** в репо |
| L-26 | E2E Redis в CI с AUTH (`requirepass`) | **закрыто** |
| L-27 | `xlsx` убран из package.json; скрипты грузят опционально | **закрыто** |
| L-28 | TOTP setup в Redis (AES-GCM), не в `Map` процесса | **закрыто** |
| L-29 | JWT `nbf` (`notBefore: '0s'`) + `clockTolerance: 5` | **закрыто** |
| L-30 | `analyze-photo` в квоте 20 гостевых сообщений | **закрыто** |
| L-31 | `REDIS_URL=redis://:password@redis:6379` в production example | **закрыто** |
| L-32 | CSP `car-service.conf` выровнен с контейнерным nginx | **закрыто** |

---

## 5. Карта на стандарты (после спринтов 1–4)

### 5.1. OWASP Top 10:2021

| Пункт | Оценка | Комментарий |
|---|---|---|
| A01 Broken Access Control | Хорошо | RBAC + IDOR; guest HMAC |
| A02 Cryptographic Failures | Хорошо- | AES-GCM, bcrypt 12, backup 80 bit; отдельные TOTP/HMAC ключи обязательны в production |
| A03 Injection | Хорошо | Prisma; письма экранированы; JSON-LD escape |
| A04 Insecure Design | Хорошо- | Wipe ПДн есть; few-shot без свободного текста; PoW на LLM-сообщениях |
| A05 Security Misconfiguration | Хорошо- | Redis AUTH, metrics за токеном, sidecar cap_drop; SMTP default без TLS |
| A06 Vulnerable Components | Хорошо- | prod audit 0; Trivy CRITICAL gate; xlsx в dev |
| A07 Auth Failures | Хорошо- | 2FA, policy, lockout 401; enum через EMAIL_NOT_VERIFIED |
| A08 Software/Data Integrity | Хорошо- | digest pin, actions SHA, SBOM; Trivy CRITICAL блокирует |
| A09 Logging/Monitoring | Хорошо- | Pino redact включая phone/fullName; metrics с токеном |
| A10 SSRF | Хорошо- | DNS + pin IP + no-redirect; NAT64 в блок-листе |

### 5.2. OWASP API Security Top 10:2023

| Пункт | Оценка |
|---|---|
| API1 BOLA | Хорошо |
| API2 Broken Auth | Хорошо- (M-25) |
| API3 Property Authorization | Хорошо |
| API4 Unrestricted Resource | Средне+ (квоты есть, PoW слаб, metrics) |
| API5 Function Authorization | Хорошо |
| API6 Business Flows | Средне (guest request, OTP/lockout enum) |
| API7 SSRF | Средне+ |
| API8 Security Misconfig | Средне |
| API9 Inventory | Хорошо- (OpenAPI 0.5.0 + drift-check) |
| API10 Unsafe Consumption | Хорошо- (HMAC вебхуки, JSON schema LLM) |

### 5.3. OWASP LLM Top 10 (2025)

| Пункт | Оценка | Комментарий |
|---|---|---|
| LLM01 Prompt Injection | Хорошо- | Маркеры, тесты jailbreak; few-shot только structured fields |
| LLM02 Insecure Output | Хорошо | JSON schema + React text |
| LLM03 Data Poisoning | Хорошо- | M-18: нет свободного текста менеджера в промпте |
| LLM04 Unbounded | Средне+ | Квоты; PoW на create + messages/SSE/photo |
| LLM05 Supply Chain | Средне | Модели Ollama не pin |
| LLM06 Sensitive Disclosure | Слабо+ | H-10 + M-41: симптомы локально; vision в облако без флага |
| LLM07 Insecure Plugin | N/A | Tool-calling нет |
| LLM08 Excessive Agency | Хорошо | Модель не пишет в CRM |
| LLM09 Overreliance | Хорошо- | Дисклеймер + safety-тесты |
| LLM10 Model Theft | Низкий | Ollama во внутренней сети |

### 5.4. ASVS 4.0.3 L2 — выборочно

| Глава | Статус |
|---|---|
| V2 Authentication | Близко к L2; enum lockout, TOTP key optional |
| V3 Session | L2: `__Host-`, reuse detection |
| V4 Access Control | Близко к L2 |
| V5 Validation | Близко к L2 |
| V6 Crypto | Не L2 (концентрация ключей) |
| V8 Data Protection | Не L2 (H-10) |
| V9 Communications | Зависит от edge; SMTP default без TLS |
| V11 Business Logic | LLM лимиты да; auth-лимитеры не в Redis |
| V12 Files | Почти L2 (magic + JPEG re-encode) |
| V14 Config | Секреты не в git; Trivy не gate |

### 5.5. CIS Docker (кратко)

| Контроль | Статус |
|---|---|
| Non-root | frontend/backend да |
| cap_drop ALL | frontend/backend/worker да; db/redis/mailpit нет или частично |
| Image digest | да |
| Redis AUTH | да |
| Bind 127.0.0.1 | да |

### 5.6. 152-ФЗ

| Требование | Факт |
|---|---|
| Согласие | Пишется в `consent_events`; сбой пишется «в никуда» |
| Локализация | Postgres на своей VM; облачный LLM выключен по умолчанию |
| Срок хранения | Гость без заявки — 24 ч; с заявкой — бессрочно |
| Уничтожение | Tombstone, связанные ПДн остаются |
| Поручение обработчику | Не видно в репо |
| Журнал доступа к ПДн | Admin audit есть; просмотр карточки клиента не логируется |

---

## 6. Положительные сценарии (регрессия)

Проверены кодом и/или тестами `backend/tests/security/`:

- Dummy OTP не JWT; неизвестный email — тот же формат токена.
- Guest token в БД = HMAC, не plaintext.
- Lockout после 5 неудач.
- Absolute URL в `joinSafeUrl` → ошибка.
- Magic bytes: PNG как JPEG отвергается.
- `escapeHtml` в письмах.
- Export/delete API отвечает 200 и анонимизирует email.
- Подмена JWT чужим секретом → 401 (`security.test.js`).
- Вебхук без HMAC → 401.
- Prompt injection «напиши курсовую» покрыт интеграционным тестом.
- CORS в production требует `CORS_ORIGIN`.
- `INTEGRATION_ENCRYPTION_KEY` обязателен в production.

---

## 7. Классификация риска для режимов

| Режим | Можно ли оставлять как есть |
|---|---|
| Закрытый стенд / пилот без реальных ПДн | Да |
| Публичное демо с регистрацией | Да, с оговорками: staff 2FA, не смешивать живые заявки с seed.demo, `/api/metrics` только с `METRICS_TOKEN` |
| Production автосервиса (заявки, телефоны, документы) | Кодовый HIGH закрыт; нужны пентест и оргмеры 152-ФЗ (см. `docs/privacy-processing.md`) |

---

## 8. Спринт 5 — выполнен вечером 15.08.2026

1. [x] Полнота удаления ПДн: wipe сообщений/ТС/эмбеддингов/follow-up; consent → 503; TTL гостя с заявкой анонимизирует ФИО/телефон (H-10).
2. [x] Обязательные `TOTP_ENCRYPTION_KEY` + `HMAC_PEPPER` в production (M-05). Dual-read HMAC на pepper+JWT.
3. [x] Lockout → тот же 401, что неверный пароль. `EMAIL_NOT_VERIFIED` после верного пароля оставлен для UX (M-25 partial).
4. [x] Auth-лимитеры через `createRateLimiter` / Redis (M-32); `/api/metrics` 404 без токена, в development — только loopback (M-27).
5. [x] PoW 16 bit + одноразовый nonce Redis SET NX на create session (M-26 partial: не на `/messages`, чтобы не ломать SSE).
6. [x] Trivy fail on CRITICAL; `xlsx` в dev не трогали (M-29, L-27).
7. [x] `cap_drop ALL` redis/mailpit; пароль Redis в `/tmp/redis.conf` (M-21).
8. [x] SSRF: `fetchSafeOutbound` pin IP + SNI/Host, NAT64 блок (M-30).
9. [x] Few-shot default off в production (M-18).
10. [x] JSON-LD escape `</`; path containment uploads (L-13, L-14).
11. [x] Vision PII-gate + квота гостя на фото (M-41, L-30).
12. [x] Не перезаписывать пароль unverified register (M-42).
13. [x] Lockout на OTP/TOTP (M-43); `REDIS_URL` с паролем в `.env.production.example` (L-31).
14. [x] CSP `car-service.conf` выровнен с контейнером (L-32).

Регрессия: `backend/tests/security/security-sprint.test.js` + `tests/integration/health.test.js` + `auth.test.js` — pass (lockout 401, unverified takeover, wipe сообщений, metrics 404, path traversal).

### Рекомендуемый спринт 6 — выполнен

1. [x] Login без `EMAIL_NOT_VERIFIED`; ссылка на `/verify-email` (M-25).
2. [x] `seed.demo` без fallback-паролей, без печати паролей, bcrypt 12, HMAC guestToken (M-36, L-19, L-20).
3. [x] product-events: allowlist имён, `props` не логируются (M-38). SMTP: production non-local требует 465/`SMTP_SECURE` или 587 STARTTLS (M-37).
4. [x] PNG re-encode (`pngjs`); WebP — allowlist чанков; GIF как `attachment` (M-40).
5. [x] `xlsx` убран из зависимостей; скрипты грузят пакет опционально (L-27).
6. [x] `docs/privacy-processing.md` + версия согласия на `/privacy` (оргконтур-шаблон).

Регрессия: image-sanitize, auth, product-events, security-sprint, health — pass.

### Спринт 7 — выполнен

1. [x] Few-shot: в промпт только verdict/vehicle/category, без свободного текста менеджера (M-18).
2. [x] PoW на `POST /messages`, `/messages/stream`, `/analyze-photo` для гостей; SSE остаётся fetch POST с заголовками (M-26).
3. [x] `seed.js` без fallback-паролей; CI e2e и Playwright читают `DEMO_*_PASSWORD` (M-36).
4. [x] Redact `phone`/`fullName`/`guestPhone`/`guestName` (L-24); `/api/health` и `/api/ready` без деталей db/redis (L-01).

Регрессия: `tests/unit/security-sprint7.test.js`, health, consultation-feedback, stream unit.

### Спринт 8 — выполнен

1. [x] `Permissions-Policy` дополнен `payment`/`usb`/`interest-cohort`/`browsing-topics` (L-06).
2. [x] Профиль не в `localStorage`: sessionStorage только `{ id, role }` (L-09).
3. [x] `guestTokenMatches` только HMAC (L-18).
4. [x] Redis AUTH в CI e2e (L-26); TOTP pending setup в Redis под AES-GCM (L-28).
5. [x] HSTS `preload` в контейнерном nginx и шаблонах deploy (L-25; edge должен не снимать заголовок).

Регрессия: `tests/unit/guest-token.test.js`, frontend `client.test.ts` (кэш профиля).

Кодовый реестр аудита закрыт. Вне репо: поручение 152-ФЗ / РКН, проверка живого edge TLS, пентест.

---

## 9. Методология повторного аудита

1. Полный обзор текущего `backend/src` (auth, users, privacy, consultations, integrations, uploads, middleware).
2. Frontend: cookies/CSRF, `localStorage`, `dangerouslySetInnerHTML`.
3. `docker-compose.yml`, Dockerfiles, nginx (`frontend/docker`, `deploy/nginx`).
4. CI, `.gitignore`, seed, Prisma schema и миграция `security_hardening`.
5. `npm audit` backend (prod + all) и frontend prod.
6. Регрессия `backend/tests/security/*` как baseline.
7. Построчная сверка утренних H/M/L с кодом (не с чекбоксами отчёта).
8. Второй проход: auth (OTP/lockout/register), Docker/CI/nginx-шаблоны, LLM/vision/uploads.

Ограничения те же: это **не** пентест. Не проверялись runtime-заголовки живого HTTPS edge, энтропия реальных секретов, ACL хоста, бэкапы Postgres, WAF.

---

## 10. След исправлений спринтов 1–4 (сжато)

Остаётся в силе: OTP HMAC, backup 80 bit, guest HMAC, Redis AUTH, nodemailer 9.0.5, LLM-квоты, magic bytes, DNS SSRF, refresh reuse, lockout, iss/aud, consent API, HSTS/CSP/security.txt, Redis rate-limit (глобальный), unique phone, SBOM/CodeQL/TruffleHog, pin digest, EXIF JPEG, staff 2FA `stp`.

Оговорки демо-стенда:

- Staff без TOTP входит, кабинет закрыт до включения 2FA.
- Профиль Compose `mail` может быть включён для OTP в Mailpit.
- HSTS отдаёт контейнерный nginx; внешний терминатор не должен снимать заголовок.
- `/api/metrics` закрыт без `METRICS_TOKEN` (в development — только loopback).

*Конец отчёта с допиской спринта 8. Файл: `docs/SECURITY-AUDIT-2026-08-15.md`.*
