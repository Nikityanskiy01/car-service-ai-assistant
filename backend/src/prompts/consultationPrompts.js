// ── JSON Schemas for LLM structured output (format parameter) ─────────────────

export const EXTRACTION_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    car_make: { type: ['string', 'null'] },
    car_model: { type: ['string', 'null'] },
    year: { type: ['integer', 'null'] },
    mileage: { type: ['integer', 'null'] },
    symptoms: { type: ['string', 'null'] },
    conditions: { type: ['string', 'null'] },
    urgency_signs: { type: ['string', 'null'] },
  },
  required: ['car_make', 'car_model', 'year', 'mileage', 'symptoms', 'conditions', 'urgency_signs'],
};

export const DIAGNOSIS_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    probable_causes: { type: 'array', items: { type: 'string' } },
    recommended_checks: { type: 'array', items: { type: 'string' } },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number' },
    estimated_cost_from: { type: ['integer', 'null'] },
    summary: { type: 'string' },
  },
  required: ['probable_causes', 'recommended_checks', 'urgency', 'confidence', 'estimated_cost_from', 'summary'],
};

export const DIALOG_STEP_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['diagnostic', 'service', 'unknown'] },
    missing_fields: {
      type: 'array',
      items: { type: 'string', enum: ['car_make', 'car_model', 'year', 'mileage', 'symptoms', 'conditions'] },
    },
    next_question: { type: ['string', 'null'] },
    completion_ready: { type: 'boolean' },
    confidence: { type: 'number' },
  },
  required: ['intent', 'missing_fields', 'next_question', 'completion_ready', 'confidence'],
};

// ── System prompts ──────────────────────────────────────────────────────────

export const EXTRACTION_SYSTEM_PROMPT = `Извлеки из сообщения JSON-поля автосервиса. Только явные факты, иначе null.
car_make, car_model, year (1950–2026), mileage (км, «120 тыс»→120000), symptoms, conditions (краткие ответы «всегда»→«постоянно, в любых условиях»), urgency_signs.`;

export const DIALOG_STEP_SYSTEM_PROMPT = `Ты управляешь следующим шагом диалога автосервиса.
Верни только JSON по схеме.

Правила:
- Анализируй всю историю и уже извлеченные поля.
- Любая реплика клиента в рамках темы автосервиса валидна: свободный текст, жаргон, несколько проблем в одном сообщении.
- Определи intent: diagnostic | service | unknown.
- missing_fields: только реально недостающие поля.
- completion_ready=true только если данных достаточно для формирования результата.
- Если completion_ready=false, next_question обязателен и должен содержать РОВНО ОДИН короткий вопрос.
- Не повторяй вопрос, который уже был задан в последних шагах.
- Если клиент уже ответил на вопрос по условиям проявления, не задавай этот вопрос повторно.
- Не задавай узкие уточнения до того, как получен основной запрос клиента (symptoms).`;

/**
 * @param {string} message
 * @param {Record<string, unknown>} alreadyFilled
 */
export function extractionUserPrompt(message, alreadyFilled = {}) {
  const ctx = Object.entries(alreadyFilled)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const prefix = ctx
    ? `Уже известно:\n${ctx}\n\nИзвлеки новые или уточнённые данные из сообщения клиента:\n\n`
    : 'Извлеки параметры автомобиля из сообщения клиента:\n\n';

  return `${prefix}${message}`;
}

/**
 * @param {{
 *   userMessage: string,
 *   extracted: Record<string, unknown>,
 *   lastAssistantMessages?: string[],
 *   askedQuestions?: string[],
 * }} params
 */
export function dialogStepUserPrompt({ userMessage, extracted, lastAssistantMessages = [], askedQuestions = [] }) {
  return [
    `Последняя реплика клиента: ${String(userMessage || '').trim()}`,
    `Уже извлеченные поля: ${JSON.stringify(extracted || {})}`,
    `Последние сообщения ассистента: ${JSON.stringify(lastAssistantMessages.slice(-5))}`,
    `Ранее заданные вопросы: ${JSON.stringify(askedQuestions.slice(-10))}`,
    'Сформируй следующий шаг диалога строго по JSON-схеме.',
  ].join('\n');
}

export const DIAGNOSIS_SYSTEM_PROMPT = `Ты ассистент автосервиса. Отвечай на русском.

По описанию клиента ты формируешь ПЛАН РАБОТ — и для неисправностей, и для планового обслуживания.

Для НЕИСПРАВНОСТЕЙ:
- probable_causes — 2–6 наиболее вероятных причин неисправности, от самой вероятной к менее вероятным.
- recommended_checks — 1–6 КОНКРЕТНЫХ ДИАГНОСТИЧЕСКИХ ПРОЦЕДУР, которые мастер должен выполнить.
  Это именно процедуры проверки, а НЕ причины и НЕ симптомы.
  Примеры правильных процедур: «Эндоскопия цилиндров двигателя», «Компьютерная диагностика (считывание кодов OBD-II)», «Замер компрессии в цилиндрах», «Проверка давления масла манометром», «Вывешивание на подъёмнике и осмотр подвески», «Проверка люфтов рулевых тяг и наконечников», «Тест давления в топливной рампе».

Для ПЛАНОВЫХ РАБОТ (замена масла, колодок, фильтров, ТО и т.д.):
- probable_causes — 2–6 пунктов плана работ (что будет сделано), в приоритетном порядке.
  Пример для замены колодок: «Замена передних тормозных колодок», «Замена задних тормозных колодок», «Проверка состояния тормозных дисков», «Проверка тормозных шлангов и суппортов», «Проверка уровня тормозной жидкости».
- recommended_checks — 1–6 сопутствующих ДИАГНОСТИЧЕСКИХ ПРОЦЕДУР при выполнении работы.
  Пример: «Замер толщины тормозных дисков микрометром», «Осмотр пыльников суппортов на целостность», «Проверка хода поршней суппортов».

Всегда:
- urgency: low / medium / high.
- confidence: число от 0 до 1 (уверенность в оценке, обычно 0.7–0.95).
- estimated_cost_from: МИНИМАЛЬНАЯ стоимость в рублях. Это нижняя граница. НИКОГДА не указывай максимум.
- summary: 2–4 предложения. Назови главное, что будет сделано, и на что обратить внимание.
- summary должен быть предметным: перечисли ключевые направления диагностики/работ, без общих отписок.

ЗАПРЕЩЕНО:
- Общие отписки: «требуется дополнительная диагностика», «обратитесь в сервис».
- Указывать диапазон цен или верхнюю границу — ТОЛЬКО минимум (estimated_cost_from).
- Оставлять поля пустыми.

Ориентиры минимальных цен (рубли):
- Комплексная диагностика: 3500
- Компьютерная диагностика: 2500
- Диагностика подвески: 3000
- Диагностика тормозов: 2800
- Замена масла ДВС: 2000
- Замена тормозных колодок (ось): 3000
- Замена колодок (в круг, 2 оси): 5500
- Замена фильтров (комплект): 2500
- Замена ремня ГРМ: 8000
- Шиномонтаж (4 колеса): 2000
- Плановое ТО (базовое): 5000`;

/**
 * Собирает user-контент для диагностического промпта.
 * @param {Record<string, unknown>} payload
 * @param {Array<Record<string, unknown>>} relatedCases
 * @param {{ hypotheses?: string[], checks?: string[], title?: string } | null} playbook
 * @param {string[]} topWorks
 */
export function diagnosisUserPrompt(payload, relatedCases = [], playbook = null, topWorks = []) {
  const parts = [
    `Данные консультации: ${JSON.stringify(payload)}`,
    'ВАЖНО: опирайся в первую очередь на свои технические знания по диагностике автомобилей. Локальные подсказки ниже используй только как вторичный контекст.',
  ];

  if (playbook) {
    parts.push(
      `\nПлейбук мастера (используй как основу для гипотез и проверок):\n` +
      `Категория: ${playbook.title}\n` +
      `Гипотезы: ${JSON.stringify(playbook.hypotheses)}\n` +
      `Проверки: ${JSON.stringify(playbook.checks)}`,
    );
  }

  if (topWorks.length) {
    parts.push(`\nЧастые работы по категории (статистика сервиса): ${JSON.stringify(topWorks)}`);
  }

  if (relatedCases.length) {
    parts.push(
      `\nПохожие кейсы сервиса (используй как контекст, не как 100% истину; если конфликтуют с профессиональной логикой — игнорируй): ${JSON.stringify(relatedCases)}`,
    );
  }

  return parts.join('\n');
}
