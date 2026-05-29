# Proxmox Self-Host Runbook

Полный гайд для деплоя в новую VM (Ubuntu) с Nginx, Docker Compose, TLS, автозапуском, бэкапами и remote editing по SSH.

## 1) Bootstrap новой VM

На VM от root:

```bash
cd /tmp
git clone <YOUR_REPO_URL> car-service-ai-assistant
cd car-service-ai-assistant
SSH_PUBKEY="ssh-ed25519 AAAA... you@host" DEPLOY_USER=carservice \
  bash deploy/proxmox/bootstrap-vm.sh
```

Что делает скрипт:
- ставит `docker`, `docker compose`, `nginx`, `ufw`, `fail2ban`, `git`;
- создаёт пользователя `carservice`;
- включает SSH по ключам и отключает `PasswordAuthentication`;
- открывает только `22`, `80`, `443`;
- готовит каталоги `/opt/car-service-ai-assistant` и `/opt/backups`.

## 2) Подготовка проекта на VM

Под `carservice`:

```bash
git clone <YOUR_REPO_URL> /opt/car-service-ai-assistant
cd /opt/car-service-ai-assistant
cp .env.proxmox.example .env.proxmox
cp backend/.env.production.example backend/.env
```

Обязательно отредактировать:
- `.env.proxmox` (`POSTGRES_PASSWORD`, при необходимости `LLM_MODEL`, bind-порты);
- `backend/.env` (`JWT_SECRET`, `CORS_ORIGIN`, `LLM_PROVIDER=openai`, `LLM_CLOUD_BASE_URL`, `LLM_API_KEY`).

## 3) Nginx + HTTPS (домен)

1. Скопировать конфиг:
```bash
sudo cp deploy/nginx/car-service.conf /etc/nginx/sites-available/car-service.conf
```

2. Заменить `your-domain.example` на ваш домен.

3. Активировать сайт и проверить синтаксис:
```bash
sudo ln -s /etc/nginx/sites-available/car-service.conf /etc/nginx/sites-enabled/car-service.conf
sudo nginx -t
sudo systemctl reload nginx
```

4. Выпустить сертификат:
```bash
bash deploy/nginx/install-certbot.sh your-domain.example you@example.com
```

## 4) Первый деплой

```bash
cd /opt/car-service-ai-assistant
bash deploy/proxmox/deploy.sh main
docker compose --env-file .env.proxmox ps
```

Проверка API:
```bash
curl -I http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:8080/api/health
curl -I https://your-domain.example/api/health
```

## 5) Автозапуск и автодеплой

```bash
sudo cp deploy/systemd/car-service-deploy.service /etc/systemd/system/
sudo cp deploy/systemd/car-service-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now car-service-deploy.service
sudo systemctl enable --now car-service-deploy.timer
```

`car-service-deploy.service` гарантирует автоподъём стека после reboot через `docker compose up -d`.

## 6) Бэкапы и логи

1. Включить бэкапы PostgreSQL:
```bash
sudo cp deploy/systemd/car-service-backup.service /etc/systemd/system/
sudo cp deploy/systemd/car-service-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now car-service-backup.timer
```

2. Включить logrotate:
```bash
sudo cp deploy/ops/logrotate-car-service /etc/logrotate.d/car-service
```

3. Тест восстановления:
```bash
ls -lah /opt/backups/postgres
bash deploy/ops/restore-postgres.sh /opt/backups/postgres/<backup-file>.sql.gz
```

## 7) Remote editing (через тебя всегда)

Рекомендуемый workflow:
- IDE подключается к VM через Remote SSH (`carservice@<vm-ip>`).
- Работа в ветке `feature/*` в `/opt/car-service-ai-assistant`.
- Перед merge: `docker compose --env-file .env.proxmox up -d` + smoke-check.
- После merge в `main`: `bash deploy/proxmox/deploy.sh main`.

Это позволяет тебе давать задачи в чате, а мне править код прямо на VM в твоём рабочем контуре.

## 8) Acceptance checklist

- `https://your-domain.example` открывается и редиректит с `http`.
- `docker compose --env-file .env.proxmox ps` показывает `healthy` для `frontend/backend/db`.
- Пользовательские потоки работают: регистрация, логин, консультация, создание заявки.
- После `sudo reboot` сервис автоматически доступен без ручного запуска.
- Бэкап создан и восстановление проверено минимум один раз.
