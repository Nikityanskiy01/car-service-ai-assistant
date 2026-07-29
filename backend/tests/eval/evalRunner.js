export {
  evaluateScenario,
  evaluatePromptContracts,
  runConsultationEval,
} from '../../src/modules/eval/consultationEval.service.js';

import { runConsultationEval } from '../../src/modules/eval/consultationEval.service.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runConsultationEval();
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`consultation eval OK: ${report.passed}/${report.total} scenarios`);
}
