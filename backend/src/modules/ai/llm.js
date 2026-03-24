import { getEnv } from '../../config/env.js';
import { progressFromExtracted } from '../../lib/consultationProgress.js';
import { AppError } from '../../lib/errors.js';
import { normalizeLlmPayload, parseLlmJson } from './parseResponse.js';

const MOCK_SEQUENCE = [
  ['make', 'Toyota'],
  ['model', 'Camry'],
  ['year', 2018],
  ['mileage', 120000],
  ['symptoms', 'Стук с передней оси при разгоне'],
  ['problemConditions', 'Проявляется на холодную, первые 5–10 минут'],
];

/**
 * @param {import('@prisma/client').ConsultationSession & { extracted: import('@prisma/client').ExtractedDiagnosticData | null }} session
 * @param {string} userContent
 */
export function mockLlmTurn(session, userContent) {
  const ext = session.extracted || {};
  for (const [key, val] of MOCK_SEQUENCE) {
    const filled =
      key === 'year' || key === 'mileage'
        ? ext[key] != null && Number.isFinite(ext[key])
        : typeof ext[key] === 'string' && ext[key].trim().length > 0;
    if (!filled) {
      const merged = { ...ext, [key]: val };
      return {
        reply:
          `Зафиксировал данные (${key}). ` +
          (userContent ? 'Если что-то неверно — напишите уточнение.' : 'Опишите симптомы подробнее.'),
        extracted: merged,
        recommendations: [
          { title: 'Подвеска / сайлентблоки', probabilityPercent: 35 },
          { title: 'Приводной вал', probabilityPercent: 20 },
        ],
        progressPercent: progressFromExtracted(merged),
        confidencePercent: 45,
        costFromMinor: 8000,
        preliminaryNote:
          'Результат предварительный и не заменяет осмотр на подъёмнике. Точная стоимость после диагностики.',
      };
    }
  }
  return {
    reply:
      'Все обязательные параметры собраны. Вы можете сохранить отчёт и оформить заявку в сервис.',
    extracted: ext,
    recommendations: [{ title: 'Диагностика ходовой части', probabilityPercent: 55 }],
    progressPercent: 100,
    confidencePercent: 72,
    costFromMinor: 12000,
    preliminaryNote:
      'Результат предварительный и не заменяет осмотр на подъёмнике. Точная стоимость после диагностики.',
  };
}

/**
 * @param {Array<{ role: string, content: string }>} messages
 */
async function realLlmTurn(messages) {
  const env = getEnv();
  const url = `${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: env.LLM_MODEL,
    messages: [
      {
        role: 'system',
        content: `Ты помощник автосервиса. Отвечай ТОЛЬКО валидным JSON без текста вокруг:
{
  "reply": "текст пользователю",
  "extracted": { "make": "", "model": "", "year": null, "mileage": null, "symptoms": "", "problemConditions": "" },
  "recommendations": [{ "title": "", "probabilityPercent": 0 }],
  "progressPercent": 0,
  "confidencePercent": null,
  "costFromMinor": null,
  "preliminaryNote": null
}
Заполняй extracted из диалога; null/пустые строки если данных нет.`,
      },
      ...messages,
    ],
    temperature: 0.3,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new AppError(503, `LLM unavailable: ${res.status} ${t.slice(0, 200)}`, 'LLM_ERROR');
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(503, 'LLM returned empty content', 'LLM_ERROR');
  }
  try {
    const raw = parseLlmJson(content);
    return normalizeLlmPayload(raw);
  } catch (e) {
    throw new AppError(503, `LLM JSON parse error: ${e.message}`, 'LLM_ERROR');
  }
}

/**
 * @param {import('@prisma/client').ConsultationSession & { extracted: import('@prisma/client').ExtractedDiagnosticData | null, messages: import('@prisma/client').Message[] }} session
 * @param {string} userContent
 */
export async function runLlmTurn(session, userContent) {
  const env = getEnv();
  if (env.LLM_MOCK) {
    return mockLlmTurn(session, userContent);
  }

  const history = session.messages.map((m) => ({
    role: m.sender === 'USER' ? 'user' : m.sender === 'ASSISTANT' ? 'assistant' : 'system',
    content: m.content,
  }));
  history.push({ role: 'user', content: userContent });

  try {
    return await realLlmTurn(history);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(503, 'LLM unavailable', 'LLM_ERROR');
  }
}
