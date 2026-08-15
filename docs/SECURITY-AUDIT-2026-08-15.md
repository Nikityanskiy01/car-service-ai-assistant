# Повторный аудит безопасности: интеллектуальный ассистент автосервиса

| Поле | Значение |
|---|---|
| Дата | 15 августа 2026 (повторное ревью вечером) |
| Объект | Весь репозиторий `car-service-ai-assistant` (backend, frontend, Docker, nginx, CI, Prisma, LLM-контур) |
| Тип | Комплексный аудит исходного кода и конфигурации (SAST / config review), плюс `npm audit` |
| База | Первичный отчёт того же дня (спринты 1–4 помечены закрытыми). Этот файл **заменяет** утреннюю версию: статусы перепроверены по коду, добавлены новые находки |
| Не входило | Внешний пентест, DAST, проверка живых TLS-сертификатов edge-прокси, социальная инженерия, физический доступ, сила секретов на сервере |
| Стандарты | OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 4.0.3 (целевой уровень L2), OWASP LLM Top 10:2025, CWE Top 25, CIS Docker Benchmark, NIST SSDF, NIST SP 800-63B, 152-ФЗ |
| Вердикт | Для публичного демо — **приемлемо**. Для обработки реальных ПДн клиентов как production — **ещё не готов**: остался 1 HIGH (полнота 152-ФЗ) и ряд MEDIUM по крипто-ключам, перечислению аккаунтов и supply-chain gate |

Секреты из `.env` / `.env.proxmox` в отчёт **не включались**. Проверялись только шаблоны, код и то, что закоммичено в репозиторий.

---

## 1. Резюме для руководства

Спринты 1–4 из утреннего аудита **в коде действительно закрыты**: OTP больше не выдаёт JWT-пустышку, backup-коды 80 бит, OTP/guestToken на HMAC, Redis с паролем, nodemailer 9.0.5, LLM-квоты, magic bytes, DNS-SSRF, refresh reuse, lockout, consent/export/delete API, HSTS/CSP/security.txt, pin образов, CodeQL/TruffleHog/SBOM.

Оборонительный фундамент сохранён: httpOnly + `__Host-` cookie в production, CSRF double-submit, RBAC, Helmet, Zod, Prisma, HMAC вебхуков, AES-256-GCM секретов интеграций, TOTP, защита последнего администратора.

**Итоговая оценка зрелости:** 7.4 / 10 (было 5.5). Уровень «укреплённое публичное демо / внутренний пилот». До ASVS L2 production с ПДн не хватает полноты уничтожения данных, разделения криптоключей и нескольких операционных gate.

| Критичность | Открыто сейчас | Было утром | Изменение |
|---|---|---|---|
| Critical | 0 | 0 | — |
| High | 1 | 9 | −8 (8 закрыты, 1 остался как остаток H-08) |
| Medium | 16 | 18+ | часть закрыта, часть новых (в т.ч. vision/PII, захват unverified) |
| Low | 17 | 12 | часть закрыта, часть новых |
| **Всего открытых** | **34** | **39** | закрыто ~31 пункт утреннего реестра; второй проход добавил 8 остатков |

`npm audit --omit=dev`: backend **0**, frontend **0**. С devDependencies backend: **3 HIGH** (`xlsx` без фикса, `brace-expansion` / `js-yaml` в nodemon/istanbul — чинятся `npm audit fix`).

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
| H-04 Публичный LLM без квоты | High | **Закрыто** (остаток → M-26) | `createLlmLimiter` 8/15 мин, vision 2, PoW на POST `/`, квота 20 |
| H-05 Redis без AUTH | High | **Закрыто** (остаток → M-21) | `--requirepass ${REDIS_PASSWORD}`, `REDIS_URL` с паролем |
| H-06 nodemailer HIGH CVE | High | **Закрыто** | `nodemailer@9.0.5`; prod audit 0 |
| H-07 guestToken plaintext | High | **Закрыто** (legacy compare → L-18) | HMAC в БД, plaintext только клиенту |
| H-08 152-ФЗ / ПДн в LLM | High | **Частично → H-10** | Consent + export/delete + cloud redact + TTL есть; уничтожение неполное |
| H-09 Демо-пароли в git | High | **Частично → M-36** | Production seed требует env; fallback-пароли и email всё ещё в исходнике |

### 3.2. Medium (утро)

| ID | Сейчас |
|---|---|
| M-01 Magic bytes | **Закрыто** (PNG/WebP/GIF не ре-энкодятся → M-40) |
| M-02 SSRF без DNS | **Частично** → M-30 TOCTOU |
| M-03 Absolute joinSafeUrl | **Закрыто** |
| M-04 Refresh reuse | **Закрыто** (`consumedAt` + family + `tokenVersion`) |
| M-05 TOTP из JWT | **Частично** → ключ есть, **не обязателен** в production |
| M-06 Нет lockout | **Закрыто** (побочный enum → M-25) |
| M-07 Кэш auth 45 с | **Закрыто** (TTL 5 с) |
| M-08 HSTS демо | **Закрыто** в контейнерном nginx и `autoservice-demo.conf`; edge не проверялся |
| M-09 Mailpit в default compose | **Закрыто** (`profiles: [mail]`); SMTP_SECURE=false → M-37 |
| M-10 Image digest | **Закрыто** |
| M-11 CI security-gate | **Частично** → Trivy `exit-code: 0` (M-29) |
| M-12 Prisma CLI в образе | **Закрыто** (`prisma` в `dependencies`) |
| M-13 HTML в письмах | **Закрыто** |
| M-14 CSP unsafe-inline / img https | **Закрыто** (`style-src 'self'`, `img-src 'self' data:`) |
| M-15 Телефон не уникален | **Закрыто** (partial unique index) |
| M-16 inline PDF | **Закрыто** (PDF `attachment`; картинки `inline`) |
| M-17 Rate limit в памяти | **Частично** → глобальный лимитер на Redis; **auth-лимитеры нет** (M-32) |
| M-18 Few-shot в промпт | **Частично** → sanitize + лимит символов, текст менеджера всё ещё в контексте |
| M-19/M-20 Delete/consent | **Частично** → API есть, уничтожение неполное (H-10) |
| M-21 Docker sidecars | **Открыто** (db/mailpit без `cap_drop`; redis без `cap_drop ALL`) |
| M-22 JWT iss/aud | **Закрыто** |
| M-23 EXIF/vision | **Закрыто** для JPEG; PNG/WebP — стрип чанков |
| M-24 Логи / request-id | **Закрыто** по заявленному объёму; `phone` в body не redact (L-24) |

### 3.3. Low (утро)

| ID | Сейчас |
|---|---|
| L-01 Health раскрывает db | **Открыто** |
| L-02 Клиентский X-Request-Id | **Закрыто** (сервер генерирует UUID/traceId) |
| L-03 Нет `__Host-` | **Закрыто** в production |
| L-04 OTP не timing-safe | **Закрыто** |
| L-05 claim `!==` | **Закрыто** (`timingSafeEqual`) |
| L-06 Permissions-Policy | **Открыто** (нет `payment`/`usb`/`interest-cohort`) |
| L-07 Cache-Control API | **Закрыто** (`no-store` на `/api`) |
| L-08 CSP Helmet vs nginx | **Закрыто** (выровнены) |
| L-09 Профиль в localStorage | **Открыто** |
| L-10 mailpit:latest | **Закрыто** |
| L-11 security.txt | **Закрыто** |
| L-12 SBOM/Dependabot | **Закрыто** |

---

## 4. Открытые находки (текущее состояние)

Нумерация новых пунктов: `H-10`, `M-25+`, `L-13+`. CVSS — ориентир.

### 4.1. High

#### H-10. Уничтожение ПДн неполное (остаток 152-ФЗ / H-08)

- **Где:** `privacy.service.js` `deleteMyAccount`; `guestSessionTtl.job.js`; `embeddingService.js` / `caseMemoryIndexer.service.js`; `ollamaService.js`; `visionService.js`
- **CWE:** CWE-212, CWE-359
- **152-ФЗ:** ст. 5, 6, 9, 18, 21 (уничтожение), 22
- **OWASP LLM:** LLM06 Sensitive Information Disclosure
- **ASVS:** V8.2.1, V8.3.2

Что уже есть: журнал `consent_events` (версия политики `2026-08-15`, IP, UA); export/delete API; redact email/телефона перед **облачной** LLM; TTL 24 ч для гостевых сессий **без** заявки; `LLM_CLOUD_PII_ALLOWED=false` в compose.

Что осталось:

1. `deleteMyAccount` — **tombstone** (email `deleted-{id}@invalid.local`, `blocked: true`), строка `users` не удаляется. Из-за этого **не срабатывает** `onDelete: Cascade` на консультации, ТС, сообщения, эмбеддинги, историю входов. Симптомы, госномер/VIN (если были), вложения и заявки остаются.
2. Export не отдаёт тексты сообщений консультации, вложения и содержимое заявок — неполный пакет субъекта.
3. Гостевая сессия **с** `serviceRequest` исключена из TTL — ФИО/телефон гостя живут бессрочно.
4. В локальный Ollama и в эмбеддинги уходят симптомы и марка/модель (это данные о здоровье ТС и часто ПДн в связке с аккаунтом). Redact облака не трогает ФИО в тексте и не маскирует симптомы.
5. **Vision обходит `LLM_CLOUD_PII_ALLOWED`:** при `LLM_PROVIDER=openai` фото уходит в cloud completions как есть (`visionService.js`), без проверки флага. На фото могут быть госномер, лицо, геолокация EXIF (JPEG чистится, PNG/WebP — слабее).
6. В репозитории нет следа договора поручения / уведомления РКН / оферты с версией, на которую ссылается `CONSENT_POLICY_VERSION`.
7. `recordConsentEvent` глотает ошибки (`catch { return null }`) — оператор может думать, что согласие записано.

**Ремонт:** Реальное удаление или крипто-стирание связанных сущностей (сообщения, extracted, embeddings, uploads, login events) с сохранением анонимной статистики; TTL и для гостевых заявок после срока хранения; маскирование ПДн и в локальный промпт по флагу; тот же PII-gate для vision; не глотать ошибку consent; юридический контур вне кода.

Для демо без живых клиентов риск низкий. Для production с заявками — **блокирующий**.

---

### 4.2. Medium

#### M-05. `TOTP_ENCRYPTION_KEY` не обязателен; HMAC-pepper = `JWT_SECRET`

- **Где:** `env.js` (`TOTP_ENCRYPTION_KEY` optional); `totp.js` `deriveKeys()` всегда добавляет `sha256('totp:'+JWT_SECRET)`; `cryptoHash.js` `pepper()` = `JWT_SECRET`
- **ASVS:** V6.1.2, V6.2.2

Отдельный ключ TOTP **поддержан**, но в production-схеме не required (в отличие от `INTEGRATION_ENCRYPTION_KEY`). `.env.example` прямо говорит: «иначе используется JWT_SECRET». HMAC для OTP, backup, guest, PoW тоже из JWT. Компрометация одного секрета + дамп БД даёт TOTP-секреты и мгновенный перебор 10⁶ OTP.

**Ремонт:** Обязать `TOTP_ENCRYPTION_KEY` и `HMAC_PEPPER` (≥32) в production; убрать fallback на JWT после миграции.

#### M-25. Lockout и «email не подтверждён» перечисляют аккаунты

- **Где:** `auth.service.js` `login`, `assertNotLocked`
- **CWE:** CWE-204; ASVS V2.2.1, V4.3.1

Несуществующий пользователь → `401` одинаковое сообщение. После 5 неудач существующий → `429 ACCOUNT_LOCKED`. Неподтверждённый клиент → `403 EMAIL_NOT_VERIFIED`. Это закрывает stuffing, но открывает enumeration (в т.ч. через известные демо-email).

**Ремонт:** На заблокированный/неподтверждённый аккаунт отвечать тем же 401 после dummy-work; факт блокировки — только в login history / алерт админу.

#### M-26. Anti-abuse PoW practically free

- **Где:** `guestPow.js` `DIFFICULTY = 2`
- **OWASP LLM:** LLM04 / LLM10

2 hex-нуля ≈ 8 бит (~256 SHA-256). Скрипт решает мгновенно. Реальная защита — IP rate limit 8/15 мин и 20 сообщений на сессию. PoW создаёт ложное чувство контроля. Сообщения/фото **не** требуют PoW (только create session).

**Ремонт:** Difficulty ≥16 бит (или капча); привязать nonce к IP в Redis (одноразовость); требовать свежий PoW и на `/messages`.

#### M-27. `GET /api/metrics` без аутентификации

- **Где:** `routes/api.js`
- **CWE:** CWE-200; ASVS V13.1.3

Публичные Prometheus-метрики: маршруты, статусы, латентность, счётчики LLM. Помогает разведке (какие API живые, когда модель падает) и даёт дешёвый scrape-DoS.

**Ремонт:** Слушать только на внутреннем порту / требовать bearer; не публиковать через frontend nginx.

#### M-30. SSRF: DNS TOCTOU

- **Где:** `safeOutboundUrl.js` `assertSafeOutboundUrlResolved`; `genericRest.adapter.js`
- **CWE:** CWE-918

DNS проверяется **до** `fetch`. Между lookup и запросом имя может указывать на `169.254.169.254` / RFC1918. Redirects отключены (`redirect: 'error'`) — это хорошо. Pin IP / custom lookup+connect нет. IPv6 NAT64 (`64:ff9b:`) не в блок-листе.

**Ремонт:** `lookup` + connect на тот же адрес (или undici dispatcher с pin); блок NAT64/link-local IPv6.

#### M-32. Auth rate limiters в памяти процесса

- **Где:** `auth.router.js` — `authLimiter` / `registerLimiter` / `forgotPasswordLimiter` / `verificationLimiter` через «голый» `express-rate-limit`
- **ASVS:** V11.1.2

Глобальный `/api` лимитер на Redis. Лимиты login/register/forgot — нет. Рестарт и N реплик обнуляют/умножают защиту.

**Ремонт:** Собрать их через `createRateLimiter`.

#### M-18. Few-shot менеджера в промпте

- **Где:** `consultationFeedback.service.js` `getConfirmedFewShotExamples`
- **OWASP LLM:** LLM03 / LLM01

`sanitizeUntrustedPromptText` режет короткие jailbreak-слова и режет длину. Текст `actualCause` / `worksDone` по-прежнему попадает в контекст диагноза для всех клиентов. Инсайдер или скомпрометированный менеджер травит модель.

**Ремонт:** Только enum/схема; не смешивать untrusted text в system; модерация; флаг уже есть (`CONSULTATION_FEEDBACK_FEW_SHOT_ENABLED`) — default false в production.

#### M-29. Trivy не валит CI

- **Где:** `.github/workflows/ci.yml` `exit-code: '0'`
- **NIST SSDF:** PW.4, PW.7

Job есть, но HIGH/CRITICAL в FS-скане не блокируют merge. `npm audit` (prod) блокирует.

**Ремонт:** `exit-code: '1'` на CRITICAL (затем HIGH) + ignore-файл для ложных.

#### M-21. Sidecar Docker hardening

- **Где:** `docker-compose.yml` `db`, `redis`, `mailpit`
- **CIS Docker:** 5.3, 5.12, 5.25

Frontend/backend/worker: `cap_drop ALL`, `no-new-privileges`. Redis: только `no-new-privileges`, пароль в `command` (виден в `docker inspect` / `/proc`). Postgres и Mailpit — без `cap_drop` / `no-new-privileges`. Mailpit UI на `127.0.0.1:8025` при профиле `mail`.

**Ремоток:** `cap_drop: ALL` на redis/mailpit; пароль Redis через `--requirepass` из файла/`REDIS_ARGS`, не argv; mailpit не в prod-профиле.

#### M-36. Демо-учётки: email и fallback-пароли в исходнике

- **Где:** `prisma/seed.demo.js`
- **CWE:** CWE-798

`demoPassword()` в production **требует** env. В non-prod остаются `Client-Demo-2026!` / `Manager-Demo-2026!` / `Admin-Demo-2026!` и `admin@example.local`. На публичном стенде при `STAFF_2FA_REQUIRED=true` staff без TOTP ограничен профилем — хорошо. Email сотрудников всё ещё известны из git (M-25 усиливает).

**Ремонт:** Убрать строковые fallback; seed.demo не вызывать на стенде с живыми ПДн.

#### M-37. SMTP без TLS по умолчанию в compose

- **Где:** `docker-compose.yml` `SMTP_SECURE: ${SMTP_SECURE:-false}`, `SMTP_HOST: mailpit`
- **ASVS:** V9.1.2

Для Mailpit ожидаемо. Если профиль `mail` выключат, но host останется внешним SMTP без `SMTP_SECURE=true` — коды 2FA/сброса идут plaintext до MX.

**Ремонт:** В production-примере `SMTP_SECURE=true` / STARTTLS обязателен, если host не mailpit.

#### M-38. `POST /api/product-events` пишет произвольные props в лог

- **Где:** `productEvents.router.js`
- **CWE:** CWE-532

Публичный endpoint (лимит 120/15 мин), `props` уходят в pino. Клиентский SDK воронки может прислать email/телефон. Redact логов не покрывает `props`.

**Ремонт:** Allowlist имён событий; не логировать `props` целиком; redact.

#### M-40. PNG/WebP/GIF без re-encode

- **Где:** `imageSanitize.js`
- **CWE:** CWE-434

JPEG декодируется и пишется заново. PNG/WebP — только drop EXIF/text chunks. GIF без обработки, при download `inline`. Полиглот HTML/JS в «картинке» частично жив.

**Ремонт:** Ре-энкод PNG/WebP; GIF → `attachment` или запретить.

#### M-41. Vision не уважает `LLM_CLOUD_PII_ALLOWED`

- **Где:** `visionService.js` (ветка `LLM_PROVIDER === 'openai'`); `analyzeConsultationPhoto`
- **OWASP LLM:** LLM06; 152-ФЗ ст. 18 (трансграничная передача)

Чат-LLM красactит email/телефон перед OpenAI. Vision сразу `fetch` на `LLM_CLOUD_BASE_URL/chat/completions` с сырым `image_url`. Шаблон `backend/.env.production.example` ставит `LLM_PROVIDER=openai`. Квота гостевых сообщений на фото **не** действует (только IP vision limiter 2/15 мин).

**Ремонт:** Тот же gate, что у chat: при `!LLM_CLOUD_PII_ALLOWED` не слать vision в облако (или только локальный Ollama). `assertGuestMessageQuota` и на photo.

#### M-42. Захват неподтверждённого аккаунта через повторную регистрацию

- **Где:** `auth.service.js` `register` (строки 146–155)
- **CWE:** CWE-620; ASVS V2.2.2

Если email ещё не `emailVerifiedAt`, повторный `POST /register` **перезаписывает** `passwordHash`, ФИО и телефон и шлёт новый код. Атакующий, знающий/угадывающий email жертвы в окне до верификации, захватывает учётку.

**Ремонт:** Не менять пароль существующего pending-пользователя; тот же generic ответ, что и для verified; rate-limit на resend.

#### M-43. Lockout только на password login

- **Где:** `accountLockout.js` вызывается лишь из `auth.service.js` `login`
- **ASVS:** V2.2.1

OTP (`verifyLoginOtp`) и TOTP (`verifyTotpChallenge`) не вызывают `assertNotLocked` / `recordFailedLogin`. После блокировки пароля вход кодом с почты/приложения остаётся открытым (если канал доступен).

**Ремонт:** Проверять lockout во всех complete-login путях; считать неудачи OTP/TOTP в тот же счётчик.

---

### 4.3. Low

| ID | Суть | Где |
|---|---|---|
| L-01 | `/api/health` и `/api/ready` отдают `db`/`redis` status | `routes/api.js` |
| L-06 | `Permissions-Policy` без `payment`, `usb`, `interest-cohort` | nginx |
| L-09 | Профиль (email, role) в `localStorage` | `frontend/src/api/client.ts` |
| L-13 | JSON-LD через `dangerouslySetInnerHTML` без escape `</script>` (данные из CMS/конфига) | `HomePage.tsx` |
| L-14 | `readAttachmentFile` не проверяет, что resolved path внутри upload root | `requestMessageAttachments.js` |
| L-18 | `guestTokenMatches` принимает legacy plaintext той же длины | `guestToken.js` |
| L-19 | `seed.demo.js` пишет `guestToken` plaintext в демо-сессии | `prisma/seed.demo.js` |
| L-20 | Seed bcrypt 10 раундов vs 12 в runtime | `seed.demo.js` |
| L-24 | Redact логов: нет `phone`, `fullName`, `req.body.props` | `logger.js` |
| L-25 | HSTS без `preload`; edge TLS не в этом репо | nginx |
| L-26 | E2E Redis в CI без AUTH (изолированный job) | `.github/workflows/ci.yml` |
| L-27 | `xlsx` HIGH в **devDependencies** (prototype pollution); CI `--omit=dev` не видит | `backend/package.json` |
| L-28 | TOTP setup (`pendingSetups`) в `Map` процесса — не шарится между репликами, секрет в RAM | `security.service.js` |
| L-29 | JWT без `nbf` (iss/aud уже есть) | `jwtTokens.js` |
| L-30 | `analyze-photo` вне квоты 20 гостевых сообщений | `consultations.service.js` |
| L-31 | `REDIS_URL=redis://redis:6379` без пароля в шаблоне production | `backend/.env.production.example` |
| L-32 | CSP drift: `car-service.conf` слабее контейнера (`style-src 'unsafe-inline'`, `img-src https:`) | `deploy/nginx/car-service.conf` |

---

## 5. Карта на стандарты (после спринтов 1–4)

### 5.1. OWASP Top 10:2021

| Пункт | Оценка | Комментарий |
|---|---|---|
| A01 Broken Access Control | Хорошо | RBAC + IDOR; guest HMAC |
| A02 Cryptographic Failures | Средне+ | AES-GCM, bcrypt 12, backup 80 bit; ключи не разделены (M-05) |
| A03 Injection | Хорошо | Prisma; письма экранированы; JSON-LD — низкий XSS |
| A04 Insecure Design | Средне | Privacy-by-design не доведён (H-10); PoW слабый |
| A05 Security Misconfiguration | Средне | Redis AUTH да; metrics публичны; sidecar caps |
| A06 Vulnerable Components | Хорошо- | prod audit 0; Trivy не gate; xlsx в dev |
| A07 Auth Failures | Хорошо- | 2FA, policy, lockout; enum через 429/403 |
| A08 Software/Data Integrity | Средне+ | digest pin, actions SHA, SBOM; Trivy не блокирует |
| A09 Logging/Monitoring | Средне+ | Pino redact расширен; metrics без ACL; product_event |
| A10 SSRF | Средне+ | DNS + no-redirect; TOCTOU остаётся |

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
| LLM01 Prompt Injection | Средне+ | Маркеры, тесты jailbreak; few-shot (M-18) |
| LLM02 Insecure Output | Хорошо | JSON schema + React text |
| LLM03 Data Poisoning | Средне | M-18 |
| LLM04 Unbounded | Средне+ | Квоты закрыли High; PoW театр |
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
| Публичное демо с регистрацией | Да, с оговорками: staff 2FA, не смешивать живые заявки с seed.demo, не публиковать `/api/metrics` |
| Production автосервиса (заявки, телефоны, документы) | Нет, пока не закрыт H-10 и M-05; затем пентест и оргмеры 152-ФЗ |

---

## 8. Рекомендуемый спринт 5 (остаток)

1. [ ] Полнота удаления ПДн: каскад/wipe сообщений, ТС, вложений, эмбеддингов; не глотать consent (H-10).
2. [ ] Обязательные `TOTP_ENCRYPTION_KEY` + `HMAC_PEPPER` в production (M-05).
3. [ ] Одинаковый 401 при lockout / unverified (M-25).
4. [ ] Auth-лимитеры на Redis (M-32); закрыть `/api/metrics` (M-27).
5. [ ] PoW ≥16 bit + одноразовый nonce (M-26) либо убрать и опереться на капчу.
6. [ ] Trivy fail on CRITICAL; убрать или заменить `xlsx` (M-29, L-27).
7. [ ] `cap_drop` на redis/mailpit; пароль Redis не в argv (M-21).
8. [ ] SSRF: pin resolved IP (M-30).
9. [ ] Few-shot default off в production (M-18).
10. [ ] JSON-LD без raw HTML; path containment на downloads (L-13, L-14).
11. [ ] Vision: тот же PII-gate, что у chat; квота гостя на фото (M-41, L-30).
12. [ ] Не перезаписывать пароль unverified при повторном register (M-42).
13. [ ] Lockout на OTP/TOTP (M-43); `REDIS_URL` с паролем в `.env.production.example` (L-31).
14. [ ] Выровнять CSP `car-service.conf` с контейнерным nginx (L-32).

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

*Конец повторного отчёта. Файл: `docs/SECURITY-AUDIT-2026-08-15.md`.*
