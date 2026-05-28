const base = 'http://127.0.0.1:3000/api/consultations';
const start = Date.now();

async function parseJsonResponse(res, label) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`${label} parse failed: status=${res.status} body=${txt.slice(0, 500)}`);
  }
}

async function run() {
  const created = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'diagnostics' }),
  });
  const session = await parseJsonResponse(created, 'create session');
  const sessionId = session?.id;
  const guestToken = session?.guestToken;
  if (!sessionId) throw new Error('no session id');
  if (!guestToken) throw new Error('no guest token');

  const inputs = [
    'Toyota',
    'Camry',
    '140000',
    'При торможении на скорости сильная вибрация руля, особенно после прогрева',
    'При торможении после прогрева и на скорости выше 60',
  ];

  let finalPayload = null;
  let lastErrorPayload = null;
  for (const content of inputs) {
    const res = await fetch(`${base}/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Consultation-Guest-Token': guestToken,
      },
      body: JSON.stringify({ content }),
    });
    const payload = await parseJsonResponse(res, `message "${content}"`);
    if (payload?.error) {
      lastErrorPayload = payload;
      break;
    }
    finalPayload = payload;
    if (Array.isArray(payload?.recommendations) && payload.recommendations.length > 0) break;
  }

  const detailRes = await fetch(`${base}/${sessionId}`, {
    headers: { 'X-Consultation-Guest-Token': guestToken },
  });
  const detail = await parseJsonResponse(detailRes, 'session detail');

  const elapsed = Date.now() - start;
  const rec = finalPayload?.recommendations?.[0];
  const recFromDetail = detail?.recommendations?.[0];
  const assistantFromDetail =
    Array.isArray(detail?.messages) && detail.messages.length
      ? String(detail.messages[detail.messages.length - 1]?.content || '')
      : null;
  console.log(
    JSON.stringify(
      {
        elapsedMs: elapsed,
        sessionId,
        finalKeys: finalPayload ? Object.keys(finalPayload) : [],
        status: finalPayload?.status,
        progress: finalPayload?.progressPercent,
        recommendationsCount: finalPayload?.recommendations?.length ?? null,
        topRecommendation: rec?.title || null,
        summary: finalPayload?.messages?.[finalPayload.messages.length - 1]?.content || null,
        lastErrorPayload,
        detailStatus: detail?.status,
        detailProgress: detail?.progressPercent,
        detailRecommendationsCount: detail?.recommendations?.length ?? null,
        detailTopRecommendation: recFromDetail?.title || null,
        detailLastAssistant: assistantFromDetail,
      },
      null,
      2,
    ),
  );
}

run().catch((err) => {
  console.error('ERR', err.message || String(err));
  process.exit(1);
});
