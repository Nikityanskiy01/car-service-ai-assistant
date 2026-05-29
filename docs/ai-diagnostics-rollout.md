# AI Diagnostics Rollout (feature-flag)

## Flags
- `CONSULTATION_FLOW_MODE=llm_first`
- `DIAGNOSIS_MODE=llm_only`
- `DIAGNOSIS_FAST_PATH_ENABLED=true`
- `DIAGNOSIS_AGENT_PROFILE=compact`
- `DIAGNOSIS_TURN_BUDGET_MS=20000`
- `DIAGNOSIS_AGENT_MAX_RETRIES=0`

## Rollout steps
1. Stage A (10%): enable compact profile and fast path on canary environment.
2. Stage B (50%): switch default frontend send path to SSE with classic fallback.
3. Stage C (100%): keep quality gate monitor active and enforce rollback thresholds.

## Auto-rollback trigger
- If `GET /api/health/ai-diagnostics/gates` returns `pass=false` for 10+ minutes:
  - revert to `DIAGNOSIS_AGENT_PROFILE=full`,
  - disable `DIAGNOSIS_FAST_PATH_ENABLED`,
  - set `CONSULTATION_FLOW_MODE=hybrid`.

## Manual verification
- Check p95 and p99 from `/api/health/ai-diagnostics`.
- Ensure `http503` does not trend upward after rollout stage change.
- Validate no repeated clarification loops in sampled sessions.
