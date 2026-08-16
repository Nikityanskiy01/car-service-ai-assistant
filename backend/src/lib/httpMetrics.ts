const MAX_KEYS = 400;
const counts = new Map();
const durations = new Map();

function key(method, route, status) {
  return `${method}|${route}|${status}`;
}

function routeLabel(req) {
  const base = req.baseUrl || '';
  const routePath = req.route?.path;
  if (routePath != null) return `${base}${routePath}` || '/';
  const path = String(req.path || req.url || '/').split('?')[0];
  return path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
}

export function recordHttpRequest(req, res, durationMs) {
  const route = routeLabel(req);
  if (route.startsWith('/api/live') || route.startsWith('/api/ready') || route.startsWith('/api/health') || route.startsWith('/api/metrics')) {
    return;
  }
  const k = key(req.method || 'GET', route, String(res.statusCode || 0));
  if (!counts.has(k) && counts.size >= MAX_KEYS) return;
  counts.set(k, (counts.get(k) || 0) + 1);
  const bucket = durations.get(k) || [];
  if (bucket.length < 200) bucket.push(durationMs);
  durations.set(k, bucket);
}

export function httpMetricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    recordHttpRequest(req, res, ms);
  });
  next();
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export function renderPrometheusMetrics(llmSnapshot) {
  const lines = [
    '# HELP http_requests_total HTTP requests by method, route and status',
    '# TYPE http_requests_total counter',
  ];
  for (const [k, value] of counts) {
    const [method, route, status] = k.split('|');
    lines.push(
      `http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"} ${value}`,
    );
  }
  lines.push('# HELP http_request_duration_ms HTTP request duration', '# TYPE http_request_duration_ms summary');
  for (const [k, samples] of durations) {
    const [method, route, status] = k.split('|');
    const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"`;
    lines.push(`http_request_duration_ms{${labels},quantile="0.5"} ${percentile(samples, 50)}`);
    lines.push(`http_request_duration_ms{${labels},quantile="0.95"} ${percentile(samples, 95)}`);
  }
  if (llmSnapshot) {
    lines.push('# HELP llm_calls_total LLM adapter calls', '# TYPE llm_calls_total counter');
    lines.push(`llm_calls_total ${llmSnapshot.totalCalls || 0}`);
    lines.push('# HELP llm_failures_total LLM adapter failures', '# TYPE llm_failures_total counter');
    lines.push(`llm_failures_total ${llmSnapshot.failures || 0}`);
    lines.push('# HELP llm_latency_ms LLM latency', '# TYPE llm_latency_ms summary');
    if (llmSnapshot.latencyMs?.p50 != null) {
      lines.push(`llm_latency_ms{quantile="0.5"} ${llmSnapshot.latencyMs.p50}`);
    }
    if (llmSnapshot.latencyMs?.p95 != null) {
      lines.push(`llm_latency_ms{quantile="0.95"} ${llmSnapshot.latencyMs.p95}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
