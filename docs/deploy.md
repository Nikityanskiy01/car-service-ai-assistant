# Деплой

Демо-хост: **https://autoservice-demo.zernov.online**  
Стек на VM: Docker Compose (loopback) + Nginx на хосте → контейнер frontend `:8080`. TLS обычно на внешнем edge (openresty), на самой VM — HTTP :80.

## Состав Compose

Файл: `docker-compose.yml`, переменные: `.env.proxmox`, секреты приложения: `backend/.env`.

| Сервис | Роль | Порт на хосте |
|--------|------|----------------|
| `frontend` | Nginx + SPA, прокси `/api` | `127.0.0.1:8080` |
| `backend` | Express, Prisma migrate при старте; без фоновых jobs | `127.0.0.1:3000` |
| `worker` | BullMQ-диагноз, outbox, SLA, reminders | нет HTTP |
| `db` | PostgreSQL 16 + pgvector (образ `docker/postgres`) | только внутренняя сеть |
| `redis` | BullMQ | только внутренняя сеть |
| `mailpit` | Перехват SMTP на демо | `127.0.0.1:1025` / UI `:8025` |

Ollama в Compose **нет**. LLM — облачный OpenAI-compatible endpoint в `backend/.env`.

## Обновление уже развёрнутого демо

После любых runtime-правок (frontend, backend, Docker, Prisma, env):

```bash
cd /home/demo/car-service-ai-assistant   # на этой VM путь может быть /opt/car-service-ai-assistant
sudo docker compose --env-file .env.proxmox up -d --build
sudo docker compose --env-file .env.proxmox ps
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
```

Ожидание: `backend` и `frontend` в статусе `healthy`, HTTP 200.

Логи:

```bash
sudo docker compose --env-file .env.proxmox logs backend --tail 100
sudo docker compose --env-file .env.proxmox logs frontend --tail 50
```

`npm run dev` **не** обновляет демо-сайт.

## Первичный выкат на новую Ubuntu VM

1. Docker Engine + Compose plugin, Nginx, git.
2. Клон репозитория в `/opt/car-service-ai-assistant` (или рабочий путь).
3. Секреты:

```bash
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
```

Обязательно задать: `POSTGRES_PASSWORD`, `JWT_SECRET` (≥32), `INTEGRATION_ENCRYPTION_KEY` (≥32), `TOTP_ENCRYPTION_KEY` (≥32), `HMAC_PEPPER` (≥32), `CORS_ORIGIN`, `APP_PUBLIC_URL`, ключ LLM.

На проде включить обязательную 2FA сотрудников: `STAFF_2FA_REQUIRED=true` в `.env.proxmox` (на демо сейчас `false`).

4. Стек: `sudo docker compose --env-file .env.proxmox up -d --build`.
5. Пользователи (пароли не коммитить):

```bash
PROD_ADMIN_EMAIL=... PROD_ADMIN_PASSWORD=... \
PROD_MANAGER_EMAIL=... PROD_MANAGER_PASSWORD=... \
PROD_CLIENT_EMAIL=... PROD_CLIENT_PASSWORD=... \
  npm --prefix backend run db:bootstrap:prod
```

На демо допустим `node prisma/seed.js` внутри контейнера backend — только для стенда.

## Nginx

Готовые конфиги:

| Файл | Когда |
|------|--------|
| `deploy/nginx/autoservice-demo.conf` | Текущее демо: HTTP :80 → `127.0.0.1:8080` |
| `deploy/nginx/car-service.conf` | Шаблон с TLS на этой же машине |
| `deploy/nginx/install-certbot.sh` | Let's Encrypt, если TLS здесь, а не на edge |

Проверка с хоста:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:3000/api/health
curl -I https://autoservice-demo.zernov.online/api/health
```

## Бэкапы и logrotate

```bash
sudo cp deploy/systemd/car-service-backup.service /etc/systemd/system/
sudo cp deploy/systemd/car-service-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now car-service-backup.timer

sudo cp deploy/ops/logrotate-car-service /etc/logrotate.d/car-service
```

Дамп: `deploy/ops/backup-postgres.sh` → `/opt/backups/postgres/`.  
Восстановление: `bash deploy/ops/restore-postgres.sh /opt/backups/postgres/<file>.sql.gz`.

Ужесточение хоста (fail2ban, sysctl): `sudo bash deploy/security/vps-hardening.sh`.

## Systemd auto-deploy

В репозитории есть `deploy/systemd/car-service-deploy.service` и `.timer`. Юнит вызывает `deploy/proxmox/deploy.sh`, **которого в репозитории нет**. Актуальный выкат — команда Compose выше. Не включайте timer, пока скрипт не появится.

## Чеклист после выката

- HTTPS (или HTTP за edge) открывает SPA, `/api/health` отвечает `ok`.
- `docker compose --env-file .env.proxmox ps` — healthy у frontend/backend/worker/db/redis.
- `STAFF_2FA_REQUIRED=true` — менеджер и админ без TOTP не получают кабинет, только настройку 2FA.
- Логин seed/prod-пользователем, консультация, заявка.
- После `sudo reboot` стек поднимается (`restart: unless-stopped`).
- Бэкап Postgres создан хотя бы раз.
