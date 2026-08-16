/**
 * k6: консультация (гость) + health. FR-042: p95 HTTP < 5s.
 * k6 run tests/perf/k6-consultation.js
 * BASE_URL=http://127.0.0.1:3000 k6 run tests/perf/k6-consultation.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    checks: ['rate>0.9'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export default function () {
  const live = http.get(`${BASE}/api/live`);
  check(live, { 'live 200': (r) => r.status === 200 });

  const created = http.post(`${BASE}/api/consultations`, JSON.stringify({}), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(created, { 'consultation created': (r) => r.status === 201 });
  const body = created.json();
  const sessionId = body && body.id;
  const guestToken = body && body.guestToken;
  if (!sessionId || !guestToken) {
    sleep(1);
    return;
  }

  const msg = http.post(
    `${BASE}/api/consultations/${sessionId}/messages`,
    JSON.stringify({ content: 'Стучит спереди на кочках, Kia Rio 2018, пробег 90000' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Consultation-Guest-Token': guestToken,
      },
    },
  );
  check(msg, { 'message accepted': (r) => r.status === 200 || r.status === 201 || r.status === 202 });
  sleep(1);
}
