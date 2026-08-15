#!/usr/bin/env node
/**
 * Live LLM extraction eval (golden set).
 * Skip when the model is not configured, unless LIVE_LLM_EVAL_REQUIRED=true.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../src/config/env.js';
import {
  EXTRACTION_FORMAT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
} from '../src/prompts/consultationPrompts.js';
import { chatCompletion } from '../src/services/ollamaService.js';
import {
  loadLiveGolden,
  parseLlmJson,
  resolveLiveEvalMode,
  scoreLiveExtraction,
  summarizeLiveEval,
} from '../src/modules/eval/liveLlmEval.js';

function skip(reason) {
  console.log(`Live LLM eval SKIP: ${reason}`);
  process.exit(0);
}

async function main() {
  const required = String(process.env.LIVE_LLM_EVAL_REQUIRED || '').toLowerCase() === 'true';
  const env = getEnv();
  const mode = resolveLiveEvalMode({
    llmEnabled: env.LLM_ENABLED,
    apiKey: env.LLM_API_KEY,
    provider: env.LLM_PROVIDER,
    required,
  });

  if (mode === 'skip') {
    skip('LLM disabled or cloud key missing (set LIVE_LLM_EVAL_REQUIRED=true to fail instead)');
  }

  if (!env.LLM_ENABLED) {
    console.error('Live LLM eval FAILED: LLM_ENABLED=false but LIVE_LLM_EVAL_REQUIRED=true');
    process.exit(1);
  }
  if (env.LLM_PROVIDER === 'openai' && !String(env.LLM_API_KEY || '').trim()) {
    console.error('Live LLM eval FAILED: LLM_API_KEY is required for openai provider');
    process.exit(1);
  }

  const golden = loadLiveGolden();
  const extractionModel = env.LLM_EXTRACTION_MODEL?.trim() || env.LLM_MODEL;
  const results = [];

  for (const testCase of golden.cases) {
    const started = Date.now();
    try {
      const raw = await chatCompletion({
        model: extractionModel,
        temperature: 0,
        timeoutMs: 45_000,
        format: EXTRACTION_FORMAT_SCHEMA,
        options: { num_predict: env.LLM_EXTRACTION_NUM_PREDICT, num_ctx: 2048 },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: extractionUserPrompt(testCase.message) },
        ],
      });
      const parsed = parseLlmJson(raw);
      const scored = scoreLiveExtraction(parsed, testCase.expect);
      results.push({
        id: testCase.id,
        ok: scored.ok,
        issues: scored.issues,
        ms: Date.now() - started,
        parsed,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        ok: false,
        issues: [error instanceof Error ? error.message : String(error)],
        ms: Date.now() - started,
      });
    }
  }

  const report = summarizeLiveEval(results, golden.minPassRatio ?? 0.8);
  const printable = {
    ok: report.ok,
    passed: report.passed,
    total: report.total,
    ratio: Number(report.ratio.toFixed(2)),
    minPassRatio: report.minPassRatio,
    model: extractionModel,
    provider: env.LLM_PROVIDER,
    cases: report.cases.map(({ parsed, ...rest }) => rest),
  };
  console.log(JSON.stringify(printable, null, 2));
  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../eval-live-report.json'),
    `${JSON.stringify(printable, null, 2)}\n`,
  );
  if (!report.ok) {
    console.error(
      `Live LLM eval FAILED: ${report.passed}/${report.total} (need ${(report.minPassRatio * 100).toFixed(0)}%)`,
    );
    process.exit(1);
  }
  console.log(`Live LLM eval OK: ${report.passed}/${report.total}`);
}

main().catch((error) => {
  console.error(`Live LLM eval FAILED: ${error?.message || String(error)}`);
  process.exit(1);
});
