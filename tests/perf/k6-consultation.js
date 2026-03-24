/**
 * k6: документирование методики нагрузки для FR-042 (p95, конкурентность).
 * Запуск: k6 run tests/perf/k6-consultation.js
 * Перед запуском задайте BASE_URL и получите JWT (скрипт упрощённый).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const TOKEN = __ENV.JWT || '';

export default function () {
  if (!TOKEN) {
    return;
  }
  const res = http.get(`${BASE}/api/users/me`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { '200': (r) => r.status === 200 });
  sleep(1);
}
