#!/usr/bin/env node
import { runConsultationEval } from '../tests/eval/evalRunner.js';

const report = runConsultationEval();
if (!report.ok) {
  console.error('Consultation eval FAILED');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(`Consultation eval OK: ${report.passed}/${report.total} scenarios`);
