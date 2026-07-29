import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { preAnalyzeSymptoms } from '../consultations/consultationAi.service.js';
import {
  DIAGNOSIS_FORMAT_SCHEMA,
  EXTRACTION_FORMAT_SCHEMA,
  diagnosisUserPrompt,
  extractionUserPrompt,
} from '../../prompts/consultationPrompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScenarios() {
  const raw = readFileSync(join(__dirname, 'scenarios.json'), 'utf8');
  return JSON.parse(raw);
}

function urgencyRank(level) {
  const order = { low: 0, medium: 1, high: 2, critical: 3 };
  return order[String(level || '').toLowerCase()] ?? -1;
}

export function evaluateScenario(scenario) {
  const input = scenario.input || {};
  const expect = scenario.expect || {};
  const result = preAnalyzeSymptoms({
    symptoms: input.symptoms,
    conditions: input.conditions,
    problemConditions: input.conditions,
  });

  const issues = [];

  if (expect.minCauses != null && result.probable_causes.length < expect.minCauses) {
    issues.push(`expected >= ${expect.minCauses} causes, got ${result.probable_causes.length}`);
  }
  if (expect.minChecks != null && result.recommended_checks.length < expect.minChecks) {
    issues.push(`expected >= ${expect.minChecks} checks, got ${result.recommended_checks.length}`);
  }
  if (expect.urgency) {
    if (result.urgency !== expect.urgency) {
      issues.push(`expected urgency ${expect.urgency}, got ${result.urgency}`);
    }
  }
  if (Array.isArray(expect.urgencyIn) && !expect.urgencyIn.includes(result.urgency)) {
    issues.push(`expected urgency in ${expect.urgencyIn.join('|')}, got ${result.urgency}`);
  }
  if (typeof expect.minUrgency === 'string') {
    if (urgencyRank(result.urgency) < urgencyRank(expect.minUrgency)) {
      issues.push(`expected min urgency ${expect.minUrgency}, got ${result.urgency}`);
    }
  }
  for (const needle of expect.causeIncludes || []) {
    const hit = result.probable_causes.some((c) => c.toLowerCase().includes(String(needle).toLowerCase()));
    if (!hit) issues.push(`cause missing fragment: ${needle}`);
  }
  for (const needle of expect.checkIncludes || []) {
    const hit = result.recommended_checks.some((c) => c.toLowerCase().includes(String(needle).toLowerCase()));
    if (!hit) issues.push(`check missing fragment: ${needle}`);
  }

  return { id: scenario.id, ok: issues.length === 0, issues, result };
}

export function evaluatePromptContracts() {
  const issues = [];
  const requiredSchemaKeys = ['type', 'properties', 'required'];
  for (const [name, schema] of [
    ['EXTRACTION_FORMAT_SCHEMA', EXTRACTION_FORMAT_SCHEMA],
    ['DIAGNOSIS_FORMAT_SCHEMA', DIAGNOSIS_FORMAT_SCHEMA],
  ]) {
    for (const key of requiredSchemaKeys) {
      if (!(key in schema)) issues.push(`${name} missing ${key}`);
    }
  }

  const prompt = diagnosisUserPrompt(
    { car_make: 'Toyota', symptoms: 'стук', conditions: 'на кочках' },
    [{ category: 'suspension' }],
    { title: 'Подвеска', hypotheses: ['Стойки'], checks: ['Люфт'] },
    ['Замена амортизаторов'],
    'P0300: пропуски',
    ['пятно масла'],
    [{ confirmed_cause: 'износ колодок' }],
  );
  for (const marker of [
    '<<<CONSULTATION_PAYLOAD>>>',
    '<<<RELATED_CASES>>>',
    '<<<CONFIRMED_DIAGNOSES>>>',
    '<<<OBD_CODES>>>',
    '<<<PHOTO_OBSERVATIONS>>>',
  ]) {
    if (!prompt.includes(marker)) issues.push(`diagnosisUserPrompt missing marker ${marker}`);
  }

  const extraction = extractionUserPrompt('BMW X5 стук', { car_make: 'BMW' });
  if (!extraction.includes('<<<CLIENT_MESSAGE>>>')) {
    issues.push('extractionUserPrompt missing CLIENT_MESSAGE marker');
  }

  return { ok: issues.length === 0, issues };
}

export function runConsultationEval() {
  const data = loadScenarios();
  const scenarioResults = data.scenarios.map(evaluateScenario);
  const promptCheck = evaluatePromptContracts();
  const failed = scenarioResults.filter((r) => !r.ok);
  const ok = failed.length === 0 && promptCheck.ok;

  return {
    ok,
    total: scenarioResults.length,
    passed: scenarioResults.length - failed.length,
    failed: failed.map((f) => ({ id: f.id, issues: f.issues })),
    promptIssues: promptCheck.issues,
    checkedAt: new Date().toISOString(),
  };
}
