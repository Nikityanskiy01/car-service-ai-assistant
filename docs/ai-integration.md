# Интеграция с ИИ (LLM)

## Обзор

Система использует локальную языковую модель **Qwen 2.5 7B** через **Ollama** для двух задач:
1. **Извлечение данных** — из сообщений клиента извлекаются параметры автомобиля и описание проблемы
2. **Диагностика** — формируется предварительное заключение с вероятными причинами и рекомендациями

Если Ollama недоступна, API возвращает `503 LLM_ERROR`.

## Архитектура LLM-пайплайна

```
Клиент (браузер)
    │
    ▼
POST /api/consultations/:id/messages/stream   ← SSE endpoint
    │
    ├── 1. State machine (без LLM)
    │   └── Определяет следующий вопрос по правилам
    │       (consultationFlow.config.js → FLOW_QUESTIONS)
    │
    ├── 2. Extraction (LLM вызов #1)
    │   ├── System prompt: EXTRACTION_SYSTEM_PROMPT
    │   ├── Format: EXTRACTION_FORMAT_SCHEMA (JSON Schema)
    │   └── Результат: { car_make, car_model, year, mileage, symptoms, conditions, urgency_signs }
    │
    ├── 3. Pre-extraction (без LLM)
    │   └── Правила: регулярки, классификация симптомов, определение категории
    │
    └── 4. Diagnosis (LLM вызов #2, когда все поля заполнены)
        ├── System prompt: DIAGNOSIS_SYSTEM_PROMPT
        ├── Format: DIAGNOSIS_FORMAT_SCHEMA (JSON Schema)
        ├── Контекст: плейбуки, статистика работ, похожие кейсы
        └── Результат: { probable_causes, recommended_checks, urgency, confidence, estimated_cost_from, summary }
```

## Модель и сервер

| Параметр | Значение |
|----------|----------|
| Сервер | Ollama (Docker или локально) |
| Модель | `qwen2.5:7b` |
| API | Ollama native `/api/chat` (не OpenAI-compatible) |
| Structured output | `format` параметр с JSON Schema |
| Streaming ответа LLM | нет (`stream: false`), стриминг — через SSE на уровне фаз |

## Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `backend/src/services/ollamaService.js` | HTTP-клиент к Ollama `/api/chat` |
| `backend/src/prompts/consultationPrompts.js` | System-промпты, JSON-схемы, функции сборки user-промптов |
| `backend/src/services/consultationFlowService.js` | State machine консультации + вызов extraction |
| `backend/src/modules/consultations/consultationAi.service.js` | Вызов diagnosis, обогащение контекста |
| `backend/src/config/consultationFlow.config.js` | Тексты вопросов, правила категорий симптомов |
| `backend/src/lib/diagnosticPlaybooks.js` | Плейбуки мастера (гипотезы и проверки по категориям) |
| `backend/src/lib/workStats.js` | Статистика частых работ из `data/work_stats.json` |
| `backend/src/services/caseMemory.service.js` | Поиск похожих завершённых кейсов в БД |
| `backend/src/lib/pricing.js` | Оценка стоимости по каталогу `data/price_catalog.json` |

## JSON-схемы structured output

### Extraction (извлечение данных)

```json
{
  "type": "object",
  "properties": {
    "car_make":       { "type": ["string", "null"] },
    "car_model":      { "type": ["string", "null"] },
    "year":           { "type": ["integer", "null"] },
    "mileage":        { "type": ["integer", "null"] },
    "symptoms":       { "type": ["string", "null"] },
    "conditions":     { "type": ["string", "null"] },
    "urgency_signs":  { "type": ["string", "null"] }
  },
  "required": ["car_make", "car_model", "year", "mileage", "symptoms", "conditions", "urgency_signs"]
}
```

### Diagnosis (диагностика)

```json
{
  "type": "object",
  "properties": {
    "probable_causes":      { "type": "array", "items": { "type": "string" } },
    "recommended_checks":   { "type": "array", "items": { "type": "string" } },
    "urgency":              { "type": "string", "enum": ["low", "medium", "high"] },
    "confidence":           { "type": "number" },
    "estimated_cost_from":  { "type": ["integer", "null"] },
    "summary":              { "type": "string" }
  },
  "required": ["probable_causes", "recommended_checks", "urgency", "confidence", "estimated_cost_from", "summary"]
}
```

## Поток консультации (state machine)

1. Клиент начинает сессию — получает приветственное сообщение
2. Каждое сообщение клиента проходит через:
   - **Pre-extraction**: правила и регулярные выражения извлекают очевидные данные (марка, модель, пробег)
   - **LLM extraction**: то, что не удалось извлечь правилами, извлекает нейросеть
   - **Merge**: результаты объединяются с приоритетом rule-based данных
3. State machine проверяет, какие поля ещё не заполнены, и задаёт следующий вопрос
4. Когда все обязательные поля заполнены — вызывается **LLM diagnosis**
5. Результат диагностики сохраняется в БД (recommendations, extracted data)

### Обязательные поля для диагностики

- `car_make` — марка автомобиля
- `car_model` — модель
- `mileage` — пробег
- `symptoms` — описание проблемы
- `conditions` — условия проявления (если диагностика, не ТО)

### Категории симптомов

Система автоматически классифицирует симптомы по категориям для выбора специализированных вопросов:

`engine`, `brakes`, `suspension`, `steering`, `cooling`, `transmission`, `electrical`, `starting_system`, `fuel_system`, `unknown`

## SSE-стриминг

Фронтенд использует endpoint `POST /api/consultations/:id/messages/stream` для получения прогресса в реальном времени.

### Формат событий

```
event: thinking
data: {"phase":"started"}

event: progress
data: {"phase":"extracting"}

event: progress
data: {"phase":"extracted","data":{...}}

event: progress
data: {"phase":"diagnosing"}

event: done
data: { ...полные данные сессии... }
```

### Фазы

| Фаза | Описание |
|------|----------|
| `started` | Сообщение принято, начата обработка |
| `extracting` | Идёт извлечение данных через LLM |
| `extracted` | Данные извлечены, проверяются |
| `diagnosing` | Формируется диагностика через LLM |

### Фронтенд

Файл `frontend/js/consult.js` читает SSE-поток через `fetch` + `ReadableStream` и отображает анимированный индикатор с текстом текущей фазы (`.bubble--thinking`).

## Обогащение промпта диагностики

При формировании диагностики в промпт включаются:

1. **Плейбук мастера** (`diagnosticPlaybooks.js`) — типичные гипотезы и проверки для данной категории симптомов
2. **Статистика работ** (`workStats.js`) — частые работы по категории и марке автомобиля
3. **Похожие кейсы** (`caseMemory.service.js`) — до 3 завершённых консультаций с похожими симптомами из БД
4. **Ориентиры цен** — встроены в system prompt (диагностика от 2500, замена масла от 2000 и т.д.)

## Проверка работоспособности

```bash
cd backend
npm run llm:check
```

Скрипт `scripts/llm-check.js` отправляет тестовый запрос к Ollama и проверяет, что ответ — валидный JSON.
