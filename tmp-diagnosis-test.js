const base = 'http://192.168.1.94:8080/api/consultations';
const start = Date.now();

async function run() {
  const sres = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'diagnostics' }),
  });
  const stext = await sres.text();
  let sdata;
  try {
    sdata = JSON.parse(stext);
  } catch (e) {
    throw new Error(`sessions parse failed: status=${sres.status} body=${stext.slice(0, 400)}`);
  }
  const sessionId = sdata?.id;
  if (!sessionId) throw new Error('no session id');

  const messages = [
    'Toyota',
    'Camry',
    '140000',
    'При торможении на скорости сильная вибрация руля, особенно после прогрева',
    'При торможении после прогрева и на скорости выше 60',
  ];

  let last;
  for (const text of messages) {
    const r = await fetch(base + '/' + sessionId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    const t = await r.text();
    try {
      last = JSON.parse(t);
    } catch (e) {
      throw new Error(`message parse failed: status=${r.status} body=${t.slice(0, 400)}`);
    }
  }

  const elapsed = Date.now() - start;
  const diag = last?.recommendations?.[0] || null;
  const top = diag?.title || '(none)';
  const assistant = String(last?.assistant_message || '').slice(0, 300);

  console.log('status', last?.status, 'sess', last?.session_status, 'progress', last?.progress, 'ms', elapsed);
  console.log('recs', last?.recommendations?.length || 0);
  console.log('top', top);
  console.log('assistant', assistant.replace(/\n/g, ' '));
}

run().catch((e) => {
  console.error('ERR', e?.message || e);
  process.exit(1);
});
