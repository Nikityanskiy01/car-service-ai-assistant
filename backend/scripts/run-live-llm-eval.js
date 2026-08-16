#!/usr/bin/env node
/**
 * Live LLM extraction + diagnosis eval (golden set).
 * Skip when the model is not configured, unless LIVE_LLM_EVAL_REQUIRED=true.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  loadLiveGolden,
  parseLlmJson,
  resolveLiveEvalMode,
  scoreLiveCase,
  summarizeLiveEval,
} from '../src/modules/eval/liveLlmEval.js';
import { PROMPT_VERSION } from '../src/prompts/consultationPrompts.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

function skip(reason) {
  console.log(`Live LLM eval SKIP: ${reason}`);
  process.exit(0);
}

function envFlag(name, fallback = '') {
  return String(process.env[name] ?? fallback);
}

function isEnabled(name, defaultTrue = true) {
  const raw = envFlag(name, defaultTrue ? 'true' : 'false').toLowerCase();
  return raw === 'true' || raw === '1';
}

function writeGithubSummary(printable) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const rows = printable.cases
    .map((c) => `| ${c.id} | ${c.kind} | ${c.ok ? 'pass' : 'fail'} | ${c.ms} | ${(c.issues || []).join('; ') || '—'} |`)
    .join('\n');
  const md = [
    `## Live LLM eval`,
    ``,
    `- result: **${printable.ok ? 'OK' : 'FAILED'}** (${printable.passed}/${printable.total}, min ${(printable.minPassRatio * 100).toFixed(0)}%)`,
    `- model: \`${printable.model}\` / ${printable.provider}`,
    `- prompt: \`${printable.promptVersion}\``,
    ``,
    `| id | kind | status | ms | issues |`,
    `|---|---|---|---:|---|`,
    rows,
    ``,
  ].join('\n');
  appendFileSync(summaryPath, md);
}

async function main() {
  process.env.LLM_CIRCUIT_BREAKER_ENABLED = process.env.LLM_CIRCUIT_BREAKER_ENABLED || 'false';

  const required = envFlag('LIVE_LLM_EVAL_REQUIRED').toLowerCase() === 'true';
  const mode = resolveLiveEvalMode({
    llmEnabled: isEnabled('LLM_ENABLED', true),
    apiKey: envFlag('LLM_API_KEY'),
    provider: envFlag('LLM_PROVIDER', 'ollama'),
    required,
  });

  if (mode === 'skip') {
    skip('LLM disabled or cloud key missing (set LIVE_LLM_EVAL_REQUIRED=true to fail instead)');
  }

  const { getEnv } = await import('../src/config/env.js');
  const {
    EXTRACTION_FORMAT_SCHEMA,
    EXTRACTION_SYSTEM_PROMPT,
    extractionUserPrompt,
    DIAGNOSIS_FORMAT_SCHEMA,
    DIAGNOSIS_SYSTEM_PROMPT,
    diagnosisUserPrompt,
  } = await import('../src/prompts/consultationPrompts.js');
  const { chatCompletion } = await import('../src/services/ollamaService.js');

  let env;
  try {
    env = getEnv();
  } catch (error) {
    console.error(`Live LLM eval FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
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
  const diagnosisModel = env.LLM_DIAGNOSIS_MODEL?.trim() || env.LLM_MODEL;
  const timeoutMs = 45_000;
  const results = [];

  for (const testCase of golden.cases) {
    const kind = testCase.kind === 'diagnosis' ? 'diagnosis' : 'extraction';
    const started = Date.now();
    const model = kind === 'diagnosis' ? diagnosisModel : extractionModel;
    try {
      const raw = await chatCompletion({
        model,
        temperature: kind === 'diagnosis' ? 0.15 : 0,
        timeoutMs,
        format: kind === 'diagnosis' ? DIAGNOSIS_FORMAT_SCHEMA : EXTRACTION_FORMAT_SCHEMA,
        options: {
          num_predict: kind === 'diagnosis' ? env.LLM_DIAGNOSIS_NUM_PREDICT : env.LLM_EXTRACTION_NUM_PREDICT,
          num_ctx: kind === 'diagnosis' ? 3072 : 2048,
        },
        messages:
          kind === 'diagnosis'
            ? [
                { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
                { role: 'user', content: diagnosisUserPrompt(testCase.payload || {}) },
              ]
            : [
                { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
                { role: 'user', content: extractionUserPrompt(testCase.message) },
              ],
      });
      const parsed = parseLlmJson(raw);
      const scored = scoreLiveCase(testCase, parsed);
      results.push({
        id: testCase.id,
        kind,
        ok: scored.ok,
        issues: scored.issues,
        ms: Date.now() - started,
        parsed,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        kind,
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
    diagnosisModel,
    provider: env.LLM_PROVIDER,
    promptVersion: PROMPT_VERSION,
    cases: report.cases.map(({ parsed, ...rest }) => rest),
  };
  console.log(JSON.stringify(printable, null, 2));
  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../eval-live-report.json'),
    `${JSON.stringify(printable, null, 2)}\n`,
  );
  writeGithubSummary(printable);
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
