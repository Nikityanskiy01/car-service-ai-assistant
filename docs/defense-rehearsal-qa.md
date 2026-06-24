# Репетиция: 10 вопросов комиссии + ответы

Прочитай вслух вопрос → ответ своими словами (не зубри дословно).

---

## 1. Опишите архитектуру системы.

**Ответ:** Клиент-серверное веб-приложение. Frontend — статические HTML/JS страницы, nginx отдаёт статику и проксирует `/api` на backend. Backend — Node.js Express, REST API, Prisma ORM, PostgreSQL. Интеллектуальный модуль — облачный VseLLM через OpenAI-compatible API. Три роли: клиент, менеджер, администратор. Консультация идёт через SSE-стрим с фазами обработки. Production — Docker Compose на Proxmox: frontend + backend + db.

**Файлы:** `docs/architecture.md`, `docker-compose.yml`, `backend/src/routes/api.js`

---

## 2. Как устроена ИИ-консультация? Почему не просто ChatGPT?

**Ответ:** Это гибридная система. Детерминированная state machine в `consultationFlowService.js` задаёт порядок сбора шести полей: марка, модель, год, пробег, симптомы, условия проявления. Сначала работают правила — regex, словари марок, intent diagnostic/service. LLM подключается точечно: извлечение JSON из текста и финальная диагностика. Есть anti-loop — защита от повторных вопросов и зацикливания. ChatGPT «в лоб» не даёт структурированную заявку, RBAC и контроль качества — у нас это встроено в backend.

**Файлы:** `consultationFlowService.js`, `consultationIntent.service.js`, `consultationAi.service.js`

---

## 3. Что такое SSE и зачем он нужен?

**Ответ:** Server-Sent Events — сервер отправляет клиенту поток событий по одному HTTP-соединению. При отправке сообщения в консультации frontend вызывает `POST .../messages/stream`. Backend шлёт события: `thinking`, `progress` (extracting, diagnosing, шаги agent), `done` или `error`. Пользователь видит, что система работает, а не «зависла». Это важно, потому что вызов LLM может занимать десятки секунд.

**Файлы:** `consultations.router.js`, `frontend/js/consult.js`

---

## 4. Как формируется заявка менеджеру?

**Ответ:** После завершения консультации клиент видит панель результата: гипотезы, confidence, срочность, ориентировочная стоимость. Нажимает «Оформить заявку» — создаётся `ServiceRequest` в PostgreSQL с контактами, данными авто, текстом проблемы и результатом анализа. Гость может создать guest-заявку без регистрации; после login сессия привязывается через claim. Менеджер в `dashboards/manager.html` видит заявку, меняет статус (New → In progress → Scheduled → Completed), пишет клиенту in-app.

**Файлы:** `schema.prisma` (ServiceRequest), `serviceRequests.service.js`, `dashboards/manager.js`

---

## 5. Как реализована безопасность?

**Ответ:** JWT access token в httpOnly cookie — JavaScript не может украсть токен при XSS. Refresh token с rotation в БД. RBAC middleware `requireRole` — CLIENT видит только свои данные, MANAGER — заявки, ADMIN — `/api/admin`. CSRF-токен на mutating requests. Гостевая консультация — отдельный `X-Consultation-Guest-Token`, timing-safe compare. Rate limit на auth. Консультации staff read-only — менеджер не пишет от имени клиента в чат.

**Файлы:** `middleware/authJwt.js`, `middleware/requireRole.js`, `middleware/consultationAccess.js`

---

## 6. Какой LLM используете и почему VseLLM?

**Ответ:** Облачный OpenAI-compatible API — VseLLM. В `.env`: `LLM_CLOUD_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (qwen/qwen3-coder-next). Вызов через `llmService.js` — единая точка `POST /v1/chat/completions` с JSON Schema для structured output. Локальный Ollama не используем: на production-сервере не нужен GPU, проще деплой и масштабирование. LLM — компонент runtime, как внешняя БД.

**Файлы:** `llmService.js`, `backend/.env.example`

---

## 7. Что будет, если LLM недоступен?

**Ответ:** Требование FR-025b. Сессия не падает. Пользователю показывается понятное сообщение на русском, можно повторить запрос. Rule-based слой частично продолжает работать — извлечение полей regex, progress bar. Нет «галлюцинированного» ответа от ассистента. Покрыто unit-тестом `ai-adapter.test.js`. На защите: если тормозит — объяснить SSE-фазы и timeout, не импровизировать.

**Файлы:** `ai-adapter.test.js`, `frontend/js/api.js` (локализация LLM_ERROR)

---

## 8. Как тестировали систему?

**Ответ:** Три уровня. Unit/integration Jest — 23 файла: consultation flow, diagnosis agent, intent, RBAC, auth, service requests. Playwright E2E — us1 (гость → регистрация → заявка), us2 (менеджер, статусы). Ручная приёмка TR-007 — 5 сценариев desktop/mobile, Pass. Нагрузочное k6 — p95 порог. CI в GitHub Actions.

**Файлы:** `docs/testing.md`, `docs/manual-acceptance-tr007.md`, `backend/tests/`

---

## 9. Сколько кода написали вы, а сколько нейросеть / IDE?

**Ответ (уверенно):** Архитектуру, предметную область и ключевую бизнес-логику проектировал и реализовывал сам. Нейросеть и IDE использовал как ускоритель для типового каркаса — Express setup, CRUD admin, шаблоны тестов. Ядро, которое нельзя отдать модели без риска: state machine консультации, правила извлечения полей, guardrails, промпты и JSON Schema, multi-step diagnosis agent, модель данных, интеграция с заявками, RBAC, frontend consult UX с SSE. Оценочно 60–70% архитектуры и доменной логики — моя работа, 30–40% — boilerplate и рефакторинг. LLM в продукте — не автор исходного кода, а внешний сервис в runtime.

**Показать при уточнении:** `consultationFlowService.js`, `consultationFlow.config.js`, `diagnosisAgent.service.js`

---

## 10. В чём практическая значимость и перспективы?

**Ответ:** Снижение нагрузки на менеджера при первичном приёме: клиент описывает проблему один раз, система структурирует данные. Рост полноты обращений — шесть обязательных полей до заявки. Менеджер получает готовый контекст и историю диалога. Развёрнуто на Proxmox: Docker Compose, nginx, HTTPS. Перспективы: интеграция с CRM, телеметрия качества ИИ (`/api/health/ai-diagnostics`), расширение playbooks по маркам авто.

**Связь с ВКР:** AS-IS (менеджер вручную) → TO-BE (веб-консультация → VseLLM → заявка).

---

## Бонус: если спросят про конкретный файл

| Спросили | Скажи |
|----------|-------|
| `buildConsultationState` | Главная функция одного хода диалога — merge rules + LLM + next question |
| `runDiagnosisAgent` | Цепочка шагов: context → hypotheses → checks → synthesis |
| `schema.prisma` | 21 модель, цепочка Session → Message → ServiceRequest |
| `consult.js` | SSE stream, fallback на REST, guest token, result panel |
| Feature flags | `CONSULTATION_FLOW_MODE`, `DIAGNOSIS_AGENT_MODE` в `.env` |

---

Полная шпаргалка: [`defense-cheatsheet.md`](defense-cheatsheet.md)
