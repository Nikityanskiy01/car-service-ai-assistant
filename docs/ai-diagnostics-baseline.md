# AI Diagnostics Baseline and SLO

## Baseline (before optimization rollout)
- Symptoms:
  - Intermittent `504 Gateway Timeout` on long diagnosis requests.
  - Multi-step diagnosis path can exceed reverse-proxy read timeout.
  - Repeated clarification loops in edge-case short answers.
- Structural causes:
  - Sequential LLM calls in one user turn (extract + dialog + diagnosis steps).
  - Agent mode latency amplification on retries.
  - Classic blocking POST path on frontend without progressive delivery by default.

## Target SLO
- `POST /api/consultations/:id/messages`:
  - p95 <= 12s on typical cases.
  - p99 <= 20s on typical cases.
- 504 rate on consultation API:
  - < 0.5% of requests.
- Quality:
  - No repeated clarification loop for the same field after max retry threshold.
  - Deterministic fallback on LLM failure without hanging request.

## Runtime telemetry endpoint
- `GET /api/health/ai-diagnostics`
- Returns:
  - in-memory p50/p95/p99 for message and LLM latency,
  - phase p50/p95,
  - counters (fallbacks, llm errors, loop preventions, budget cutoffs, etc.).

## Rollout validation checklist
1. Capture baseline snapshot for 24h.
2. Enable optimizations by feature flags.
3. Compare p95/p99 and 504 rate against baseline.
4. Roll back if p95 regresses by >20% or 504 > 0.5%.
