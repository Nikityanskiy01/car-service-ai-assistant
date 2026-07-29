import { performance } from 'node:perf_hooks';
import { getEnv } from '../src/config/env.js';
import { chatCompletion } from '../src/services/ollamaService.js';
import { resolveLlmModels } from '../src/services/llmStatus.service.js';

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function measure(model, label) {
  const started = performance.now();
  await chatCompletion({
    model,
    temperature: 0,
    timeoutMs: 45_000,
    messages: [
      { role: 'system', content: 'Ответь одним словом: ok' },
      { role: 'user', content: `latency-check ${label}` },
    ],
  });
  return performance.now() - started;
}

async function main() {
  const env = getEnv();
  if (!env.LLM_ENABLED) {
    console.error('LLM disabled — set LLM_ENABLED=true');
    process.exit(1);
  }

  const models = resolveLlmModels(env);
  const runs = Number(process.env.LLM_BENCH_RUNS || 3);
  const extractionTimes = [];
  const diagnosisTimes = [];

  for (let i = 0; i < runs; i += 1) {
    extractionTimes.push(await measure(models.extraction, 'extraction'));
    diagnosisTimes.push(await measure(models.diagnosis, 'diagnosis'));
  }

  const report = {
    provider: env.LLM_PROVIDER,
    runs,
    extraction: {
      model: models.extraction,
      p50Ms: Math.round(percentile(extractionTimes, 50)),
      p95Ms: Math.round(percentile(extractionTimes, 95)),
    },
    diagnosis: {
      model: models.diagnosis,
      p50Ms: Math.round(percentile(diagnosisTimes, 50)),
      p95Ms: Math.round(percentile(diagnosisTimes, 95)),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});
