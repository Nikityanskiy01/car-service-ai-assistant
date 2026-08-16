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

const URGENCY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function asList(value) {
  return Array.isArray(value) ? value : [];
}

export function scoreLiveExtraction(parsed, expect: any = {}) {
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

/**
 * Score a live diagnosis JSON against loose golden expectations (urgency band, list sizes, needles).
 * @param parsed
 * @param expect
 * @returns
 */
export function scoreLiveDiagnosis(parsed, expect: any = {}) {
  const issues = [];
  const row = parsed && typeof parsed === 'object' ? parsed : {};
  const causes = asList(row.probable_causes).map((v) => String(v));
  const checks = asList(row.recommended_checks).map((v) => String(v));
  const urgency = asLower(row.urgency);
  const haystack = `${causes.join(' ')} ${checks.join(' ')} ${row.summary || ''}`;

  if (expect.minCauses != null && causes.length < Number(expect.minCauses)) {
    issues.push(`probable_causes expected >= ${expect.minCauses}, got ${causes.length}`);
  }
  if (expect.minChecks != null && checks.length < Number(expect.minChecks)) {
    issues.push(`recommended_checks expected >= ${expect.minChecks}, got ${checks.length}`);
  }
  if (Array.isArray(expect.urgencyIn) && !expect.urgencyIn.map(asLower).includes(urgency)) {
    issues.push(`urgency expected in ${expect.urgencyIn.join('|')}, got ${row.urgency}`);
  }
  if (typeof expect.minUrgency === 'string') {
    const got = URGENCY_RANK[urgency] ?? -1;
    const need = URGENCY_RANK[asLower(expect.minUrgency)] ?? 0;
    if (got < need) {
      issues.push(`urgency expected >= ${expect.minUrgency}, got ${row.urgency}`);
    }
  }
  if (expect.maxUrgency && typeof expect.maxUrgency === 'string') {
    const got = URGENCY_RANK[urgency] ?? 99;
    const cap = URGENCY_RANK[asLower(expect.maxUrgency)] ?? 3;
    if (got > cap) {
      issues.push(`urgency expected <= ${expect.maxUrgency}, got ${row.urgency}`);
    }
  }
  if (expect.summaryIncludes && !includesAll(row.summary, expect.summaryIncludes)) {
    issues.push(`summary missing ${JSON.stringify(expect.summaryIncludes)}`);
  }
  for (const needle of expect.causeIncludes || []) {
    if (!causes.some((c) => includesAny(c, needle))) {
      issues.push(`cause missing fragment: ${needle}`);
    }
  }
  for (const needle of expect.textIncludes || []) {
    if (!includesAny(haystack, needle)) {
      issues.push(`diagnosis text missing fragment: ${needle}`);
    }
  }
  const confidence = Number(row.confidence);
  if (expect.minConfidence != null && !(Number.isFinite(confidence) && confidence >= Number(expect.minConfidence))) {
    issues.push(`confidence expected >= ${expect.minConfidence}, got ${row.confidence}`);
  }

  return { ok: issues.length === 0, issues };
}

export function scoreLiveCase(testCase, parsed) {
  const kind = testCase.kind === 'diagnosis' ? 'diagnosis' : 'extraction';
  const scored = kind === 'diagnosis'
    ? scoreLiveDiagnosis(parsed, testCase.expect)
    : scoreLiveExtraction(parsed, testCase.expect);
  return { kind, ...scored };
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
 * @returns
 */
export function resolveLiveEvalMode({
  llmEnabled,
  apiKey,
  provider,
  required,
}: any = {}) {
  if (required && !llmEnabled) return 'run';
  if (!llmEnabled) return 'skip';
  if (provider === 'openai' && !String(apiKey || '').trim()) return required ? 'run' : 'skip';
  return 'run';
}
