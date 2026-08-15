import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadLiveGolden(pathname = join(__dirname, '../../../tests/eval/live-golden.json')) {
  return JSON.parse(readFileSync(pathname, 'utf8'));
}

function asLower(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function includesAny(haystack, needles) {
  const text = asLower(haystack);
  const list = Array.isArray(needles) ? needles : [needles];
  return list.some((n) => text.includes(asLower(n)));
}

function includesAll(haystack, needles) {
  const text = asLower(haystack);
  const list = Array.isArray(needles) ? needles : [needles];
  return list.every((n) => text.includes(asLower(n)));
}

/**
 * Score one live extraction payload against golden expectations.
 * @param {Record<string, unknown>} parsed
 * @param {Record<string, unknown>} expect
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function scoreLiveExtraction(parsed, expect = {}) {
  const issues = [];
  const row = parsed && typeof parsed === 'object' ? parsed : {};

  if (expect.makeIncludes && !includesAny(row.car_make, expect.makeIncludes)) {
    issues.push(`car_make missing ${JSON.stringify(expect.makeIncludes)}, got ${row.car_make}`);
  }
  if (expect.modelIncludes && !includesAny(row.car_model, expect.modelIncludes)) {
    issues.push(`car_model missing ${JSON.stringify(expect.modelIncludes)}, got ${row.car_model}`);
  }
  if (expect.year != null && Number(row.year) !== Number(expect.year)) {
    issues.push(`year expected ${expect.year}, got ${row.year}`);
  }
  if (expect.mileageMin != null) {
    const mileage = Number(row.mileage);
    if (!Number.isFinite(mileage) || mileage < Number(expect.mileageMin)) {
      issues.push(`mileage expected >= ${expect.mileageMin}, got ${row.mileage}`);
    }
  }
  if (expect.symptomsIncludes && !includesAll(row.symptoms, expect.symptomsIncludes)) {
    issues.push(`symptoms missing ${JSON.stringify(expect.symptomsIncludes)}, got ${row.symptoms}`);
  }
  if (expect.conditionsIncludes && !includesAll(row.conditions, expect.conditionsIncludes)) {
    issues.push(`conditions missing ${JSON.stringify(expect.conditionsIncludes)}, got ${row.conditions}`);
  }
  if (expect.obdIncludes && !includesAny(row.obd_codes, expect.obdIncludes)) {
    issues.push(`obd_codes missing ${JSON.stringify(expect.obdIncludes)}, got ${row.obd_codes}`);
  }

  return { ok: issues.length === 0, issues };
}

export function parseLlmJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : text;
  return JSON.parse(body);
}

export function summarizeLiveEval(results, minPassRatio = 0.8) {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const ratio = total === 0 ? 0 : passed / total;
  return {
    ok: ratio >= minPassRatio,
    total,
    passed,
    failed: total - passed,
    ratio,
    minPassRatio,
    cases: results,
  };
}

/**
 * @returns {'run'|'skip'}
 */
export function resolveLiveEvalMode({
  llmEnabled,
  apiKey,
  provider,
  required,
} = {}) {
  if (required && !llmEnabled) return 'run';
  if (!llmEnabled) return 'skip';
  if (provider === 'openai' && !String(apiKey || '').trim()) return required ? 'run' : 'skip';
  return 'run';
}
