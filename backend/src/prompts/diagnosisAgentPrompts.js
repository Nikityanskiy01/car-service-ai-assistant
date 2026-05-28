export const AGENT_CONTEXT_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    normalized_symptoms: { type: ['string', 'null'] },
    normalized_conditions: { type: ['string', 'null'] },
    inferred_intent: { type: 'string', enum: ['diagnostic', 'service', 'unknown'] },
    key_signals: { type: 'array', items: { type: 'string' } },
    missing_data: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'normalized_symptoms',
    'normalized_conditions',
    'inferred_intent',
    'key_signals',
    'missing_data',
  ],
};

export const AGENT_HYPOTHESES_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    probable_causes: { type: 'array', items: { type: 'string' } },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
  },
  required: ['probable_causes', 'urgency', 'confidence', 'rationale'],
};

export const AGENT_CHECKS_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    recommended_checks: { type: 'array', items: { type: 'string' } },
    estimated_cost_from: { type: ['integer', 'null'] },
    work_scope: { type: 'array', items: { type: 'string' } },
  },
  required: ['recommended_checks', 'estimated_cost_from', 'work_scope'],
};

export const AGENT_FINAL_FORMAT_SCHEMA = {
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

export const AGENT_CONTEXT_SYSTEM_PROMPT = `Ты диагност-аналитик автосервиса.
Твоя задача: структурировать вход клиента и выделить ключевые сигналы для следующего шага.
Верни только JSON по схеме. Никакого текста вне JSON.`;

export function agentContextUserPrompt(payload, relatedCases = [], playbook = null, topWorks = []) {
  return [
    `Данные клиента: ${JSON.stringify(payload)}`,
    `Похожие кейсы: ${JSON.stringify(relatedCases || [])}`,
    `Плейбук: ${JSON.stringify(playbook || {})}`,
    `Частые работы: ${JSON.stringify(topWorks || [])}`,
    'Сформируй нормализованный контекст и список недостающих данных.',
  ].join('\n');
}

export const AGENT_HYPOTHESES_SYSTEM_PROMPT = `Ты старший диагност.
На основе нормализованного контекста предложи вероятные причины/направления работ.
Верни только JSON по схеме.`;

export function agentHypothesesUserPrompt(payload, contextState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Нормализованный контекст: ${JSON.stringify(contextState)}`,
    'Сформируй аккуратный набор вероятных причин и оцени срочность.',
  ].join('\n');
}

export const AGENT_CHECKS_SYSTEM_PROMPT = `Ты мастер-приемщик.
Сформируй проверочные процедуры и минимальную оценку стоимости входа в работы.
Верни только JSON по схеме.`;

export function agentChecksUserPrompt(payload, contextState, hypothesesState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Контекст: ${JSON.stringify(contextState)}`,
    `Гипотезы: ${JSON.stringify(hypothesesState)}`,
    'Сформируй список конкретных проверок (без воды).',
  ].join('\n');
}

export const AGENT_FINAL_SYSTEM_PROMPT = `Ты формируешь финальный ответ диагностики для API.
Нужно строго вернуть JSON в контракте: probable_causes, recommended_checks, urgency, confidence, estimated_cost_from, summary.
summary — 2-4 предложения, по сути и без пустых фраз.`;

export function agentFinalUserPrompt(payload, contextState, hypothesesState, checksState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Контекст: ${JSON.stringify(contextState)}`,
    `Гипотезы: ${JSON.stringify(hypothesesState)}`,
    `Проверки: ${JSON.stringify(checksState)}`,
    'Собери финальный результат в API-контракт.',
  ].join('\n');
}
