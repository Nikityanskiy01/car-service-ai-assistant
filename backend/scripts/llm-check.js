import { getEnv } from '../src/config/env.js';
import { chatCompletion } from '../src/services/ollamaService.js';

function safePreview(text, maxLen = 500) {
  const s = String(text ?? '');
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

async function main() {
  const env = getEnv();

  const content = await chatCompletion({
    model: env.LLM_MODEL,
    temperature: 0,
    timeoutMs: 45_000,
    messages: [
      {
        role: 'system',
        content: 'Ответь одним словом: ok',
      },
      { role: 'user', content: 'Проверка соединения' },
    ],
  });

  const reply = String(content || '').trim();
  if (!reply) {
    console.error('LLM check failed: empty assistant reply');
    process.exit(1);
  }

  console.log('LLM OK');
  console.log(
    JSON.stringify(
      {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL,
        baseUrl: env.LLM_PROVIDER === 'openai' ? env.LLM_CLOUD_BASE_URL : env.LLM_BASE_URL,
        reply: safePreview(reply, 120),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(`LLM check failed: ${e?.message || String(e)}`);
  process.exit(1);
});
