process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-chars-long!!';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://fox:fox@localhost:5433/foxmotors_test';
process.env.LLM_API_KEY = process.env.LLM_API_KEY || 'test-key';
process.env.LLM_CLOUD_BASE_URL = process.env.LLM_CLOUD_BASE_URL || 'https://api.vsellm.ru/v1';
process.env.LLM_MODEL = process.env.LLM_MODEL || 'qwen/qwen3-coder-next';
process.env.CONSULTATION_FLOW_MODE = process.env.CONSULTATION_FLOW_MODE || 'hybrid';
process.env.DIAGNOSIS_MODE = process.env.DIAGNOSIS_MODE || 'hybrid';
process.env.DIAGNOSIS_TURN_BUDGET_MS = process.env.DIAGNOSIS_TURN_BUDGET_MS || '20000';
process.env.DIAGNOSIS_MIN_REMAINING_MS = process.env.DIAGNOSIS_MIN_REMAINING_MS || '6000';
process.env.DIAGNOSIS_FAST_PATH_ENABLED = process.env.DIAGNOSIS_FAST_PATH_ENABLED || 'true';
process.env.DIAGNOSIS_COMPLEXITY_THRESHOLD = process.env.DIAGNOSIS_COMPLEXITY_THRESHOLD || '4';
process.env.DIAGNOSIS_AGENT_PROFILE = process.env.DIAGNOSIS_AGENT_PROFILE || 'compact';
process.env.DIAGNOSIS_AGENT_USE_HINTS = process.env.DIAGNOSIS_AGENT_USE_HINTS || 'false';
process.env.SSE_HEARTBEAT_MS = process.env.SSE_HEARTBEAT_MS || '25000';
