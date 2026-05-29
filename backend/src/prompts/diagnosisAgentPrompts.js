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

export const AGENT_REASONING_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    probable_causes: { type: 'array', items: { type: 'string' } },
    recommended_checks: { type: 'array', items: { type: 'string' } },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number' },
    estimated_cost_from: { type: ['integer', 'null'] },
  },
  required: ['probable_causes', 'recommended_checks', 'urgency', 'confidence', 'estimated_cost_from'],
};

export const AGENT_SUMMARY_FORMAT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
  },
  required: ['summary'],
};

export const AGENT_CONTEXT_SYSTEM_PROMPT = `Ты диагност-аналитик автосервиса.
Твоя задача: структурировать вход клиента и выделить ключевые сигналы для следующего шага.
Верни только JSON по схеме. Никакого текста вне JSON.`;

export function agentContextUserPrompt(payload, relatedCases = [], playbook = null, topWorks = []) {
  const parts = [`Данные клиента: ${JSON.stringify(payload)}`];
  if (Array.isArray(relatedCases) && relatedCases.length) {
    parts.push(`Похожие кейсы: ${JSON.stringify(relatedCases)}`);
  }
  if (playbook && typeof playbook === 'object' && Object.keys(playbook).length) {
    parts.push(`Контекст мастера (optional hint): ${JSON.stringify(playbook)}`);
  }
  if (Array.isArray(topWorks) && topWorks.length) {
    parts.push(`Частые работы (optional hint): ${JSON.stringify(topWorks)}`);
  }
  parts.push('Сформируй нормализованный контекст и список недостающих данных.');
  return parts.join('\n');
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

export const AGENT_REASONING_SYSTEM_PROMPT = `Ты эксперт-диагност автосервиса.
Сформируй причины и проверки максимально конкретно.
Верни только JSON по схеме.
Без общих отписок и повторов.`;

export const AGENT_SUMMARY_SYSTEM_PROMPT = `Ты сервисный консультант.
Сделай короткий итог (2-3 предложения) по причинам и плану проверок.
Верни только JSON по схеме.`;

export function agentFinalUserPrompt(payload, contextState, hypothesesState, checksState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Контекст: ${JSON.stringify(contextState)}`,
    `Гипотезы: ${JSON.stringify(hypothesesState)}`,
    `Проверки: ${JSON.stringify(checksState)}`,
    'Собери финальный результат в API-контракт.',
  ].join('\n');
}

export function agentReasoningUserPrompt(payload, contextState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Контекст: ${JSON.stringify(contextState)}`,
    'Сформируй вероятные причины, проверки, срочность, confidence и минимальную стоимость.',
  ].join('\n');
}

export function agentSummaryUserPrompt(payload, reasoningState) {
  return [
    `Исходные данные: ${JSON.stringify(payload)}`,
    `Причины и проверки: ${JSON.stringify(reasoningState)}`,
    'Сделай краткий итог для клиента без воды.',
  ].join('\n');
}
