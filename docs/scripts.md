# npm-скрипты

Все скрипты выполняются из `backend/`:

```bash
cd backend
npm run <script>
```

## Основные

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `dev` | `nodemon src/server.js` | Запуск в режиме разработки (автоперезагрузка) |
| `start` | `node src/server.js` | Production-запуск |
| `test` | `node --experimental-vm-modules … jest --runInBand` | Юнит + интеграционные тесты (ESM) |
| `test:watch` | `jest --watch` | Тесты в режиме наблюдения |
| `lint` | `eslint src tests` | Линтинг кода |

## База данных

| Скрипт | Описание |
|--------|----------|
| `db:setup` | Полная инициализация: миграции + seed одной командой (`scripts/db-setup.mjs`) |
| `db:migrate` | `prisma migrate deploy` — применить миграции |
| `db:seed` | `node prisma/seed.js` — заполнить тестовыми данными |
| `db:push` | `prisma db push` — синхронизировать схему без миграций (dev) |
| `db:studio` | `prisma studio` — GUI для просмотра данных в браузере |
| `db:ensure-test` | `scripts/ensure-test-database.mjs` — создать тестовую БД |
| `prisma:generate` | `prisma generate` — перегенерировать клиент Prisma |
| `prisma:migrate` | `prisma migrate deploy` — алиас для db:migrate |

## LLM / AI

| Скрипт | Описание |
|--------|----------|
| `llm:check` | `scripts/llm-check.js` — проверить доступность Ollama и корректность ответа |
| `smoke:consultation` | `scripts/smoke-consultation.js` — дымовой тест полного цикла консультации |

## Данные

| Скрипт | Описание |
|--------|----------|
| `prices:build` | `scripts/build-price-catalog.js` — пересобрать `data/price_catalog.json` |
| `stats:build` | `scripts/build-work-stats.js` — пересобрать `data/work_stats.json` |

## E2E (из корня проекта)

```bash
# из корня, НЕ из backend/
npm run test:e2e
```

Определён в корневом `package.json`, запускает Playwright.

## Docker

```bash
# из корня проекта
docker compose up -d       # поднять PostgreSQL + Ollama
docker compose down         # остановить
docker compose ps           # статус контейнеров
docker compose logs ollama  # логи Ollama (полезно при первой загрузке модели)
```
