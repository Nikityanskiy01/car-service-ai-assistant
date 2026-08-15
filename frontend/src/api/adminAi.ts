import { api } from './client';

export type CaseMemoryStats = {
  indexedSessions: number;
  completedSessions: number;
  coveragePercent: number;
  semanticEnabled: boolean;
  lexicalFallback: boolean;
  embeddingModel: string | null;
  topK: number;
  maxScan?: number;
  pgvectorEnabled?: boolean;
  pgvectorAvailable?: boolean;
  lastIndexedAt: string | null;
};

export type CaseMemorySearchResult = {
  score: number | null;
  source: 'semantic' | 'lexical';
  make: string | null;
  model: string | null;
  symptomCategory: string | null;
  topRecommendations: string[];
  costFromMinor: number | null;
  categoryMatch: boolean;
};

export type CaseMemorySearchResponse = {
  query: string;
  semanticEnabled: boolean;
  results: CaseMemorySearchResult[];
};

export type CaseMemoryBackfillResult = {
  total: number;
  indexed: number;
  skipped: number;
  dryRun: boolean;
};

export function getCaseMemoryStats() {
  return api<CaseMemoryStats>('/admin/ai/memory/stats');
}

export function searchCaseMemory(body: {
  symptoms: string;
  make?: string;
  model?: string;
  conditions?: string;
  limit?: number;
}) {
  return api<CaseMemorySearchResponse>('/admin/ai/memory/search', { method: 'POST', body });
}

export function backfillCaseMemory(body?: { limit?: number; dryRun?: boolean }) {
  return api<CaseMemoryBackfillResult>('/admin/ai/memory/backfill', { method: 'POST', body: body || {} });
}

export type LlmEvalReport = {
  ok: boolean;
  total: number;
  passed: number;
  failedCount: number;
  promptOk: boolean;
  checkedAt: string;
  failed: Array<{ id: string; issues: string[] }>;
};

export function getLlmEvalReport() {
  return api<LlmEvalReport>('/admin/llm-eval');
}
