# Быстрый старт

Как поднять стек, войти в кабинеты и не перепутать Docker с локальным Vite.

## Что это

Веб-приложение автосервиса: публичный сайт, ИИ-консультация, заявки, записи, кабинеты клиента / менеджера / администратора.

**Стек:** React (Vite + TypeScript) · Node.js + Express + Prisma · PostgreSQL · Redis · LLM (OpenAI-compatible / Ollama).

**Демо в проде:** https://autoservice-demo.zernov.online  
На этой машине демо обслуживает Docker Compose, не `npm run dev`.

---

## 1. Основной запуск — Docker Compose

**Требования:** Docker + Docker Compose, файлы `.env.proxmox` и `backend/.env`.

```bash
cd /home/demo/car-service-ai-assistant   # или корень клона

cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
# отредактируйте секреты: JWT_SECRET, INTEGRATION_ENCRYPTION_KEY,
# TOTP_ENCRYPTION_KEY, HMAC_PEPPER, CORS_ORIGIN, LLM_API_KEY, POSTGRES_PASSWORD

sudo docker compose --env-file .env.proxmox up -d --build
sudo docker compose --env-file .env.proxmox ps
```

| Сервис | URL |
|--------|-----|
| Сайт (Nginx в контейнере frontend) | http://127.0.0.1:8080 |
| API напрямую | http://127.0.0.1:3000/api/health |
| Mailpit (письма, только demo/dev) | http://127.0.0.1:8025 |

Контейнеры: `frontend`, `backend`, `db`, `redis`, `mailpit`. PostgreSQL и Redis **не** публикуются на хост — к ним ходит только backend внутри сети Compose.

Пользователей после первого подъёма:

```bash
sudo docker compose --env-file .env.proxmox exec backend node prisma/seed.js
# демо-заявки и записи (не для production с живыми клиентами):
sudo docker compose --env-file .env.proxmox exec backend node prisma/seed.demo.js
```

### Учётные записи seed

Email по умолчанию: `client@example.local`, `manager@example.local`, `admin@example.local`.  
Пароли **только** из `DEMO_CLIENT_PASSWORD` / `DEMO_MANAGER_PASSWORD` / `DEMO_ADMIN_PASSWORD` (в `.env.proxmox` или окружении контейнера). Fallback-паролей в `seed.js` нет.

Вход: `/login` (email или телефон + пароль). Демо-вход без пароля отключён.

---

## 2. Frontend в Vite (опционально)

Нужен, когда правите UI и хотите HMR. API берётся из Docker-backend на `:3000`.

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Открыть: http://127.0.0.1:5173  
Прокси `/api` → `VITE_API_PROXY_TARGET` (по умолчанию `http://127.0.0.1:3000`). Шаблон: `frontend/.env.example`.

---

## 3. Локальный backend без Docker (редко)

Compose **не** пробрасывает Postgres на `localhost:5433`. Локальный `npm --prefix backend run dev` заработает, только если вы сами поднимите PostgreSQL и пропишете `DATABASE_URL` в `backend/.env`.

Для обычной разработки это не нужно: правьте код и пересобирайте контейнеры (см. ниже).

```bash
cp backend/.env.example backend/.env
npm --prefix backend install
npm --prefix backend run db:setup   # migrate + seed, нужен доступный Postgres
npm --prefix backend run dev
```

Если Vite должен ходить в этот процесс, а не в Docker:

```env
# frontend/.env.local
VITE_API_PROXY_TARGET=http://127.0.0.1:3001
```

---

## 4. Куда заходить после логина

| Роль | Стартовый URL |
|------|----------------|
| Клиент | `/dashboard/client` |
| Менеджер | `/dashboard/manager` |
| Администратор | `/dashboard/admin` |

Полная карта экранов: [product.md](./product.md).

**Горячие клавиши в админке и у менеджера:** `Ctrl+K` — command palette.

Старые URL (`/dashboard/admin/users`, `/dashboard/client/requests`, `*.html`) редиректят на актуальные маршруты.

---

## 5. После изменений в коде

Демо-сайт отдаёт **собранные контейнеры**. Локальный Vite не обновляет https://autoservice-demo.zernov.online.

Из корня репозитория:

```bash
sudo docker compose --env-file .env.proxmox up -d --build
sudo docker compose --env-file .env.proxmox ps
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
```

Пересборка нужна после правок `frontend/**`, `backend/**`, Docker-файлов, Prisma-схемы, env.

---

## 6. Полезные команды

```bash
# lint / сборка / тесты
npm run lint
npm run build
npm run test:frontend
npm run test:backend
npm run test:e2e
npm run test:ai

# seed с хоста (нужен DATABASE_URL до живой БД)
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run db:seed:demo

# LLM
npm --prefix backend run llm:check
npm --prefix backend run llm:bench

# память кейсов
npm --prefix backend run case-memory:backfill
```

---

## 7. LLM

В `backend/.env` для облака (типичный прод/демо):

```env
LLM_PROVIDER=openai
LLM_FALLBACK_ENABLED=true
LLM_CLOUD_BASE_URL=https://api.vsellm.ru/v1
LLM_API_KEY=<ключ>
LLM_MODEL=qwen3.5-flash
LLM_EXTRACTION_MODEL=qwen3.5-flash
LLM_DIAGNOSIS_MODEL=qwen3.5-flash
```

Локально через Ollama (ставится **на хост**, в Compose её нет):

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=qwen2.5:7b
LLM_EXTRACTION_MODEL=qwen2.5:3b
LLM_DIAGNOSIS_MODEL=qwen2.5:7b
```

Из контейнера backend `127.0.0.1` — это сам контейнер. Для Ollama на хосте используйте IP шлюза Docker или публикуйте Ollama так, чтобы контейнер до него достучался. Проверка: `npm --prefix backend run llm:check` или `GET /api/admin/llm-status` под админом.

При сбое модели консультация **не падает**: rule-based fallback (гибрид правил + LLM).

---

## 8. Частые проблемы

| Симптом | Что сделать |
|---------|-------------|
| Сайт на :8080 старый | Пересобрать Compose, не полагаться на Vite |
| «Требуется авторизация» | Неверный email/пароль или Vite смотрит не в тот backend |
| `Too many attempts` / «Слишком много попыток» | Rate limit на `/auth/login` (Redis `rl:*`, 15 мин). Сброс: `sudo docker compose --env-file .env.proxmox exec redis redis-cli --no-auth-warning KEYS 'rl:*'` и `DEL` ключей. Рестарт backend счётчик в Redis не сбрасывает. |
| ИИ молчит | `llm:check`, ключ, `LLM_CLOUD_BASE_URL`; на демо должен быть облачный провайдер |
| Письма не приходят | Mailpit UI на :8025; в проде нужен реальный SMTP в `.env.proxmox` |
| Backend unhealthy | Логи: `sudo docker compose --env-file .env.proxmox logs backend --tail 80` |

---

## 9. Секреты

**Не коммитить:** `.env.proxmox`, `backend/.env`, `frontend/.env.local`, ключи API.

Шаблоны: `.env.proxmox.example`, `backend/.env.example`, `backend/.env.production.example`, `frontend/.env.example`.
