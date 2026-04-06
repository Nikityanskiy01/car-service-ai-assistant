// ── JSON Schemas for Ollama structured output (format parameter) ─────────────

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

// ── System prompts ──────────────────────────────────────────────────────────

export const EXTRACTION_SYSTEM_PROMPT = `Ты модуль извлечения данных для автомобильного сервиса.
Из сообщения клиента извлеки параметры автомобиля и описание проблемы.

Правила:
- Извлекай ТОЛЬКО то, что явно сказано в сообщении. Не додумывай.
- car_make — марка (BMW, Toyota, Kia и т.д.).
- car_model — модель (X5, Camry, Rio и т.д.). Допускаются буквенно-цифровые коды.
- year — год выпуска, целое число 1950–2026. Если не указан — null.
- mileage — пробег в километрах (целое число). «120 тыс» = 120000. Если не указан — null.
- symptoms — описание неисправности или запрос клиента (замена масла, стук, вибрация и т.д.).
- conditions — при каких условиях проявляется (на холодную, при торможении, на ходу и т.д.). Если клиент отвечает кратко «всегда», «постоянно», «в любое время», «не зависит от условий» — запиши это в conditions своими словами (например «постоянно, в любых условиях»), не ставь null.
- urgency_signs — признаки срочности (дым, течь, перегрев, мигает чек и т.д.).
- Если значение отсутствует в сообщении — ставь null.`;

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

export const DIAGNOSIS_SYSTEM_PROMPT = `Ты ассистент автосервиса. Отвечай на русском.

По описанию клиента ты формируешь ПЛАН РАБОТ — и для неисправностей, и для планового обслуживания.

Для НЕИСПРАВНОСТЕЙ:
- probable_causes — 3–5 наиболее вероятных причин неисправности.
- recommended_checks — 2–5 КОНКРЕТНЫХ ДИАГНОСТИЧЕСКИХ ПРОЦЕДУР, которые мастер должен выполнить.
  Это именно процедуры проверки, а НЕ причины и НЕ симптомы.
  Примеры правильных процедур: «Эндоскопия цилиндров двигателя», «Компьютерная диагностика (считывание кодов OBD-II)», «Замер компрессии в цилиндрах», «Проверка давления масла манометром», «Вывешивание на подъёмнике и осмотр подвески», «Проверка люфтов рулевых тяг и наконечников», «Тест давления в топливной рампе».

Для ПЛАНОВЫХ РАБОТ (замена масла, колодок, фильтров, ТО и т.д.):
- probable_causes — 3–5 пунктов плана работ (что будет сделано).
  Пример для замены колодок: «Замена передних тормозных колодок», «Замена задних тормозных колодок», «Проверка состояния тормозных дисков», «Проверка тормозных шлангов и суппортов», «Проверка уровня тормозной жидкости».
- recommended_checks — 2–5 сопутствующих ДИАГНОСТИЧЕСКИХ ПРОЦЕДУР при выполнении работы.
  Пример: «Замер толщины тормозных дисков микрометром», «Осмотр пыльников суппортов на целостность», «Проверка хода поршней суппортов».

Всегда:
- urgency: low / medium / high.
- confidence: число от 0 до 1 (уверенность в оценке, обычно 0.7–0.95).
- estimated_cost_from: МИНИМАЛЬНАЯ стоимость в рублях. Это нижняя граница. НИКОГДА не указывай максимум.
- summary: 2–4 предложения. Назови главное, что будет сделано, и на что обратить внимание.

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
  const parts = [`Данные консультации: ${JSON.stringify(payload)}`];

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
      `\nПохожие кейсы сервиса (используй как контекст, не как 100% истину): ${JSON.stringify(relatedCases)}`,
    );
  }

  return parts.join('\n');
}
