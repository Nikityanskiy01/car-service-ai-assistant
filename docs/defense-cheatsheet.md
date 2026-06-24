# Fox Motors — шпаргалка на защиту (1 стр.)

**Тема:** интеллектуальная система первичной консультации клиентов автосервиса  
**Студент:** Пойманов Н.В., 221-323 | **Demo:** production-сервер (Proxmox, Docker)

---

## За 30 секунд

Клиент пишет проблему **свободным текстом** → система **уточняет** 6 полей (авто + симптомы + условия) → **ИИ** даёт предварительный результат (гипотезы, проверки, срочность, cost «от», confidence) → **заявка** → **менеджер** в кабинете.

**Не «чат с GPT»:** поверх LLM — **state machine + правила + guardrails**.

**Стек:** HTML/CSS/JS | Express | PostgreSQL/Prisma | VseLLM (OpenAI API) | JWT/RBAC | SSE

---

## Demo (5–7 мин, на сервере)

1. Консультация (гость) → фраза: *«Skoda Octavia 2018, 114000 км, стук в подвеске на холодную»*
2. Progress bar, sidebar полей, SSE-фазы (extracting → diagnosing)
3. Result panel: causes, confidence, «от … ₽», disclaimer
4. Регистрация → claim сессии → «Оформить заявку»
5. Login **manager@example.com** / `1q2w3e4r5t` → заявка → статус In progress → сообщение клиенту

**Логины:** user `1q2w3e4r` | manager `1q2w3e4r5t` | admin `1q2w3e4r5t6y`

---

## Карта репозитория

| Путь | Суть |
|------|------|
| `frontend/consult.html` + `js/consult.js` | Чат, SSE, result panel |
| `frontend/js/api.js` | REST, cookies, CSRF, guest token |
| `backend/src/services/consultationFlowService.js` | **Ядро:** state machine, anti-loop |
| `backend/src/services/diagnosisAgent.service.js` | Multi-step agent (JSON Schema) |
| `backend/src/services/llmService.js` | VseLLM `/v1/chat/completions` |
| `backend/src/modules/consultations/` | API консультаций + SSE |
| `backend/prisma/schema.prisma` | 21 сущность БД |
| `docker-compose.yml` | nginx + backend + PostgreSQL |

---

## Один ход консультации

1. `POST /api/consultations/:id/messages/stream` (SSE)
2. **Rules first:** regex марок, пробег, «на холодную» (`consultationIntent`, `consultationFlow.config`)
3. **LLM:** извлечение JSON-полей + финальная диагностика
4. 6 полей: make, model, year, mileage, symptoms, conditions
5. Полные → `generateDiagnosis` / `runDiagnosisAgent`
6. Сохранение → `ServiceRequest` для менеджера

---

## Роли

| Роль | Доступ |
|------|--------|
| CLIENT | Свои консультации, заявки, отчёты |
| MANAGER | Все заявки, переписка, просмотр консультаций |
| ADMINISTRATOR | + users, CMS, analytics |
| Гость | Консультация без входа, guest-заявка |

---

## Ответы в одну строку

| Вопрос | Ответ |
|--------|-------|
| Актуальность | Разные каналы, бытовой язык клиента, ручной приём → автоматизация + структурированная заявка |
| vs CRM/боты | Свободный текст + гибрид rules+LLM + confidence/cost + кабинет менеджера |
| PostgreSQL | Реляционная модель, транзакции, Prisma migrations |
| Auth | JWT httpOnly cookies, refresh rotation, RBAC, CSRF |
| SSE | Push фаз обработки без polling |
| VseLLM | Облачный OpenAI-compatible API, без Ollama/GPU на сервере |
| LLM упал | FR-025b: ошибка без fake-ответа, retry, rule-based частично работает |
| Тесты | 23 Jest, Playwright us1–us2, TR-007 Pass |
| Масштаб | ~24k LOC, ~75 routes, 16 экранов, 21 сущность БД |

---

## «Сколько вы / сколько ИИ в коде?»

> Архитектуру и доменную логику проектировал сам. ИИ — инструмент для boilerplate. **Ядро:** state machine, правила извлечения, guardrails, промпты/JSON Schema, agent pipeline, модель данных, RBAC. LLM в runtime — **внешний сервис**, как PostgreSQL.

**Мои ключевые файлы:** `consultationFlowService.js`, `consultationIntent.service.js`, `consultationFlow.config.js`, `consultationPrompts.js`, `diagnosisAgent.service.js`, `consultationAi.service.js`, `schema.prisma`, `consult.js`

**Оценка (если давят):** 60–70% архитектура/логика — моя, 30–40% каркас/рефакторинг с IDE.

---

## Утро защиты

- [ ] Сайт на сервере открывается
- [ ] 1 прогон demo на сервере
- [ ] pptx под рукой
- [ ] LLM тормозит → «SSE + timeout/fallback FR-025b»
