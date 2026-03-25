const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

async function mustJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

async function main() {
  const createRes = await fetch(`${API_BASE}/api/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const created = await mustJson(createRes);

  const sessionId = created.id;
  const guestToken = created.guestToken;
  if (!sessionId || !guestToken) {
    throw new Error(`Missing session id or guestToken: ${JSON.stringify(created).slice(0, 500)}`);
  }

  const msgRes = await fetch(`${API_BASE}/api/consultations/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-consultation-guest-token': guestToken,
    },
    body: JSON.stringify({
      content:
        'Toyota Camry 2018, пробег 120000. Стук с передней оси при разгоне. На холодную 5–10 минут.',
    }),
  });
  const detail = await mustJson(msgRes);

  const last = detail.messages?.[detail.messages.length - 1];
  const out = {
    sessionId,
    status: detail.status,
    progressPercent: detail.progressPercent,
    extracted: detail.extracted,
    assistantLastMessage: last?.sender === 'ASSISTANT' ? last.content : undefined,
    recommendations: detail.recommendations,
  };

  console.log('SMOKE OK');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(`SMOKE FAILED: ${e?.message || String(e)}`);
  process.exit(1);
});

