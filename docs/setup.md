# Установка и запуск

Актуальная инструкция объединена с onboarding: **[ONBOARDING.md](./ONBOARDING.md)**.

Кратко:

```bash
docker compose up -d
npm --prefix frontend install
npm --prefix backend install
cp backend/.env.example backend/.env
npm --prefix backend run db:setup
npm run dev
```

Открыть: `http://127.0.0.1:5173/` · API: `http://127.0.0.1:3000/api`

Дальше — порты, учётки, Docker vs локальный backend, LLM и типичные проблемы: [ONBOARDING.md](./ONBOARDING.md).
