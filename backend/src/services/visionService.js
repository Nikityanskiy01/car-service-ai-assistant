import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

const VISION_PROMPT =
  'Ты помощник автосервиса. Опиши только то, что видно на фото автомобиля или узла (тормоза, двигатель, лампы, утечки). ' +
  'Коротко: 3–6 пунктов на русском. Не ставь окончательный диагноз. Если фото не про автомобиль — так и скажи.';

function resolveOllamaBaseUrl(raw) {
  return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

function resolveOpenAiBaseUrl(raw) {
  return raw.replace(/\/$/, '');
}

/**
 * @param {string} mimeType
 * @param {string} base64
 */
function toDataUrl(mimeType, base64) {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * @param {{ mimeType: string, imageBase64: string }} params
 */
export async function analyzeVehiclePhoto({ mimeType, imageBase64 }) {
  const env = getEnv();
  if (!env.LLM_ENABLED) {
    return {
      observations: [],
      summary: 'Анализ фото недоступен: модуль ИИ отключён.',
      analysis_available: false,
    };
  }

  const model = String(env.LLM_VISION_MODEL || 'llava').trim();
  const base64 = String(imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!base64 || base64.length < 100) {
    throw new Error('invalid image payload');
  }

  const timeoutMs = Number(env.LLM_VISION_TIMEOUT_MS) > 0 ? Number(env.LLM_VISION_TIMEOUT_MS) : 90_000;

  if (env.LLM_PROVIDER === 'openai' && String(env.LLM_API_KEY || '').trim()) {
    const url = `${resolveOpenAiBaseUrl(env.LLM_CLOUD_BASE_URL)}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(env.LLM_API_KEY || '').trim()}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: toDataUrl(mimeType, base64) } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`vision http ${res.status}: ${t.slice(0, 160)}`);
    }
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    return normalizeVisionText(text);
  }

  const url = `${resolveOllamaBaseUrl(env.LLM_BASE_URL)}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: VISION_PROMPT, images: [base64] }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`vision http ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = String(data?.message?.content || '').trim();
  logger.info({ model, chars: text.length }, 'vision analysis completed');
  return normalizeVisionText(text);
}

/**
 * @param {string} text
 */
function normalizeVisionText(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((x) => x.replace(/^[-*•\d.)]+\s*/, '').trim())
    .filter((x) => x.length >= 4)
    .slice(0, 8);
  return {
    observations: lines,
    summary: lines.length ? lines.join(' ') : String(text || '').trim(),
    analysis_available: lines.length > 0,
    disclaimer: 'Наблюдения по фото предварительные и не заменяют осмотр мастера.',
  };
}
