import { getEnv } from '../src/config/env.js';

function safePreview(text, maxLen = 500) {
  const s = String(text ?? '');
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

async function main() {
  const env = getEnv();
  const url = `${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model: env.LLM_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Отвечай ТОЛЬКО валидным JSON без текста вокруг. JSON должен иметь ключ "reply" (строка).',
      },
      { role: 'user', content: 'Верни JSON с reply="ok".' },
    ],
    temperature: 0,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  if (!res.ok) {
    console.error(`LLM check failed: ${res.status} ${safePreview(rawText)}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error(`LLM check failed: invalid JSON from server: ${safePreview(rawText)}`);
    process.exit(1);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`LLM check failed: missing choices[0].message.content: ${safePreview(rawText)}`);
    process.exit(1);
  }

  let assistantJson;
  try {
    assistantJson = JSON.parse(content);
  } catch {
    console.error(`LLM check failed: assistant content is not JSON: ${safePreview(content)}`);
    process.exit(1);
  }

  if (typeof assistantJson.reply !== 'string' || assistantJson.reply.trim().length === 0) {
    console.error(`LLM check failed: assistant JSON missing non-empty "reply": ${safePreview(content)}`);
    process.exit(1);
  }

  console.log('LLM OK');
  console.log(JSON.stringify({ baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL, reply: assistantJson.reply }, null, 2));
}

main().catch((e) => {
  console.error(`LLM check failed: ${e?.message || String(e)}`);
  process.exit(1);
});

