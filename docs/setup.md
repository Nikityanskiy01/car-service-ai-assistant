# Установка и запуск

Пошаговая инструкция по развёртыванию AI Fox Motors локально.

## Требования

| Компонент | Версия |
|-----------|--------|
| Node.js | 22 LTS+ (фиксируется в `.nvmrc`) |
| npm | идёт с Node |
| Docker + Docker Compose | для PostgreSQL и Ollama |

## 1. Клонирование

```bash
git clone <url-репозитория>
cd car-service-ai-assistant
```

## 2. Docker-контейнеры (БД + LLM)

```bash
docker compose up -d
```

Поднимает:
- **PostgreSQL 16** на порту `5433` (пользователь `fox`, пароль `fox`, БД `foxmotors`)
- **Ollama** на порту `11434` — автоматически скачивает модель `qwen2.5:7b` при первом запуске

## 3. Backend

```bash
cd backend
npm install
cp .env.example .env    # при первом запуске
npm run db:setup        # миграции + seed
npm run dev             # запуск в режиме разработки (nodemon)
```

Сервер слушает `http://127.0.0.1:3000` и раздаёт фронтенд из `../frontend`.

### Альтернативный ручной порядок

```bash
cd backend
npx prisma migrate deploy   # применить миграции
npm run db:seed              # создать тестовых пользователей
npm run dev
```

## 4. Проверка LLM

```bash
cd backend
npm run llm:check
```

Если видите `LLM OK` — нейросеть работает. Если ошибка — проверьте, что Ollama запущена: `docker compose ps`.

## 5. Открыть в браузере

```
http://127.0.0.1:3000/
```

Или `http://<ваш-LAN-IP>:3000` с другого устройства в сети (CORS разрешает в development).

## Тестовые учётные записи

| Email | Пароль | Роль |
|-------|--------|------|
| `user@example.com` | `1q2w3e4r` | Клиент |
| `manager@example.com` | `1q2w3e4r5t` | Менеджер |
| `admin@example.com` | `1q2w3e4r5t6y` | Администратор |

Дополнительно (E2E):
- `admin@fox.local` / `Admin12345!` — администратор
- `manager@fox.local` / `Admin12345!` — менеджер

## Ollama без Docker

Если предпочитаете локальную установку:

1. Скачайте [Ollama](https://ollama.com/) и установите
2. `ollama pull qwen2.5:7b`
3. В `backend/.env`:
   ```
   LLM_BASE_URL=http://127.0.0.1:11434
   LLM_MODEL=qwen2.5:7b
   ```

## Типичные проблемы

| Симптом | Решение |
|---------|---------|
| Порт 3000 занят | Смените `PORT` в `.env` |
| Prisma: таблица не найдена | `npx prisma migrate deploy` из `backend/` |
| Страница не открывается | Проверьте хост/порт, сверьте `CORS_ORIGIN` |
| ИИ не отвечает (503) | `docker compose ps` — запущена ли Ollama; `docker compose exec ollama ollama list` — скачана ли модель |
| PostgreSQL недоступен | `docker compose ps`, проверьте `DATABASE_URL` |
