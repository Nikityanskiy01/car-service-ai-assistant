import { backfillConsultationCases } from '../src/services/caseMemoryIndexer.service.js';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

const result = await backfillConsultationCases({ dryRun, limit });
console.log(JSON.stringify(result, null, 2));
