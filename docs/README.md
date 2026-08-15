# Документация

Актуальные гайды проекта. Источник правды по коду — репозиторий, не архивные спеки.

| Документ | Зачем |
|----------|--------|
| [ONBOARDING.md](./ONBOARDING.md) | Запуск стека, учётки, LLM, типичные проблемы |
| [architecture.md](./architecture.md) | Стек, модули, поток консультации, auth |
| [product.md](./product.md) | Роли, экраны, публичный сайт |
| [testing.md](./testing.md) | Lint, unit, integration, e2e, eval, CI |
| [deploy.md](./deploy.md) | Docker Compose, Nginx, бэкапы, демо-хост |
| [demo.md](./demo.md) | Золотой путь для живой демонстрации |
| [STRIX.md](./STRIX.md) | AI-пентест Strix: скиллы, CLI, разрешённые цели |
| [CHANGELOG.md](../CHANGELOG.md) | Журнал спринтов |

Шаблоны окружения: `backend/.env.example`, `backend/.env.production.example`, `frontend/.env.example`, `.env.proxmox.example`, `.env.strix.example`.

Контракт API: инвентарь [`api-route-inventory.json`](./api-route-inventory.json), генерация OpenAPI — `npm run openapi:sync` → `specs/001-ai-consultation-platform/contracts/openapi.yaml` (`npm run openapi:check` в CI).
