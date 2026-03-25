import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';

export async function initClientDashboard() {
  const user = requireAuth(['CLIENT']);
  if (!user) return;

  const root = $('#clientRoot');
  let selectedRequestId = null;
  let selectedSessionId = null;
  let selectedReportId = null;
  let reportsCache = [];
  let activeTab = 'profile';

  async function tryClaimPendingGuest() {
    const sid = sessionStorage.getItem('consultSessionId');
    const gt = sessionStorage.getItem('consultGuestToken');
    if (!sid || !gt) return;
    try {
      await api(`/consultations/${sid}/claim`, { method: 'POST', body: { guestToken: gt } });
      sessionStorage.removeItem('consultGuestToken');
      sessionStorage.setItem('consultMode', 'auth');
    } catch {
      /* ignore */
    }
  }

  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.dash__tab').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.dash__panel').forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
    try {
      window.location.hash = `tab=${encodeURIComponent(tab)}`;
    } catch {
      /* ignore */
    }
  }

  function initTabs() {
    const fromHash = (() => {
      const h = String(window.location.hash || '').replace(/^#/, '');
      const m = h.match(/(?:^|&)tab=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    })();
    const initial = fromHash || 'profile';
    document.querySelectorAll('.dash__tab').forEach((b) => {
      b.addEventListener('click', () => setActiveTab(b.dataset.tab));
    });
    setActiveTab(initial);
  }

  function badge(text, tone = 'ghost') {
    const cls = tone === 'warn' ? 'pill' : tone === 'ok' ? 'pill' : 'pill pill--ghost';
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  function fmtMoney(rub) {
    const n = Number(rub);
    if (!Number.isFinite(n)) return '—';
    return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
  }

  function renderConsultDetail(s) {
    const box = $('#sessDetail');
    if (!box) return;
    if (!s) {
      box.innerHTML = `<p class="muted" style="margin:0">Консультация не выбрана</p>`;
      return;
    }
    const chat = (s.messages || [])
      .map(
        (m) =>
          `<div class="bubble ${m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'}">${escapeHtml(m.content)}</div>`,
      )
      .join('');
    const ext = s.extracted || {};
    const recs = (s.recommendations || [])
      .slice(0, 5)
      .map((r) => `<li>${escapeHtml(r.title)} (${Number(r.probabilityPercent) || 0}%)</li>`)
      .join('');

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
        <strong>${formatDate(s.createdAt)}</strong>
        ${badge(`${s.status}`, s.status === 'COMPLETED' ? 'ok' : s.status === 'AI_ERROR' ? 'warn' : 'ghost')}
      </div>
      <p class="muted" style="margin:0.5rem 0 0.75rem">Прогресс: ${s.progressPercent ?? 0}% · Уверенность: ${
        s.confidencePercent != null ? `${s.confidencePercent}%` : '—'
      } · Ориентир по стоимости: ${s.costFromMinor != null ? `от ${fmtMoney(s.costFromMinor)}` : '—'}</p>
      <div class="table-wrap" style="margin:0.75rem 0">
        <table class="data">
          <tbody>
            <tr><th>Авто</th><td>${escapeHtml(ext.make || '—')} ${escapeHtml(ext.model || '')} ${
              ext.year != null ? escapeHtml(String(ext.year)) : ''
            }</td></tr>
            <tr><th>Пробег</th><td>${ext.mileage != null ? escapeHtml(String(ext.mileage)) : '—'}</td></tr>
            <tr><th>Симптомы</th><td>${escapeHtml(ext.symptoms || '—')}</td></tr>
            <tr><th>Условия</th><td>${escapeHtml(ext.problemConditions || '—')}</td></tr>
          </tbody>
        </table>
      </div>
      ${
        recs
          ? `<div style="margin:0.75rem 0">
              <strong>Рекомендации</strong>
              <ul style="margin:0.35rem 0 0; padding-left:1.1rem">${recs}</ul>
            </div>`
          : ''
      }
      ${s.preliminaryNote ? `<p class="alert alert--info">${escapeHtml(s.preliminaryNote)}</p>` : ''}
      <div class="chat" style="max-height:260px">${chat || '<p class="muted">Нет сообщений</p>'}</div>
      <p style="margin:0.75rem 0 0; display:flex; gap:0.5rem; flex-wrap:wrap">
        <a class="btn btn--ghost" href="/consult.html" style="text-decoration:none">Продолжить в чате</a>
        ${!s.serviceRequest ? `<button type="button" class="btn btn--primary" id="btnCreateSr">Создать заявку</button>` : ''}
      </p>
    `;

    box.querySelector('#btnCreateSr')?.addEventListener('click', async () => {
      try {
        await api(`/consultations/${s.id}/service-request`, { method: 'POST' });
        await uiAlert({ title: 'Заявка создана', message: 'Заявка создана. Смотрите статус в разделе «Заявки».' });
        await refresh();
      } catch (e) {
        await uiAlert({ title: 'Ошибка', message: e.message });
      }
    });
  }

  function renderReportDetail(r) {
    const box = $('#repDetail');
    if (!box) return;
    if (!r) {
      box.innerHTML = `<p class="muted" style="margin:0">Отчёт не выбран</p>`;
      return;
    }
    const snap = r.snapshotJson || {};
    const ext = snap.extracted || {};
    const recs = (snap.recommendations || [])
      .slice(0, 8)
      .map((x) => `<li>${escapeHtml(x.title)} (${Number(x.probabilityPercent) || 0}%)</li>`)
      .join('');
    box.innerHTML = `
      <strong>${escapeHtml(r.label || 'Отчёт')}</strong>
      <p class="muted" style="margin:0.5rem 0 0.75rem">${formatDate(r.createdAt)} · Статус: ${escapeHtml(
        snap.status || '—',
      )}</p>
      <div class="table-wrap">
        <table class="data">
          <tbody>
            <tr><th>Авто</th><td>${escapeHtml(ext.make || '—')} ${escapeHtml(ext.model || '')} ${
              ext.year != null ? escapeHtml(String(ext.year)) : ''
            }</td></tr>
            <tr><th>Пробег</th><td>${ext.mileage != null ? escapeHtml(String(ext.mileage)) : '—'}</td></tr>
            <tr><th>Симптомы</th><td>${escapeHtml(ext.symptoms || '—')}</td></tr>
            <tr><th>Условия</th><td>${escapeHtml(ext.problemConditions || '—')}</td></tr>
          </tbody>
        </table>
      </div>
      ${
        recs
          ? `<div style="margin-top:0.75rem"><strong>Рекомендации</strong><ul style="margin:0.35rem 0 0; padding-left:1.1rem">${recs}</ul></div>`
          : ''
      }
    `;
  }

  async function refresh() {
    const [sessions, requests, reports, bookings] = await Promise.all([
      api('/consultations'),
      api('/service-requests'),
      api('/users/me/consultation-reports'),
      api('/bookings'),
    ]);

    $('#sessList').innerHTML =
      sessions.length === 0
        ? `<li class="muted">Пока нет консультаций. <a href="/consult.html">Начать консультацию</a></li>`
        : sessions
            .map((s) => {
              const tone = s.status === 'COMPLETED' ? 'ok' : s.status === 'AI_ERROR' ? 'warn' : 'ghost';
              return `<li class="card" data-sid="${s.id}" style="margin-bottom:0.5rem;cursor:pointer">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
                  <strong>${formatDate(s.createdAt)}</strong>
                  ${badge(`${s.status} · ${s.progressPercent ?? 0}%`, tone)}
                </div>
                ${s.extracted?.make || s.extracted?.model ? `<div class="muted">${escapeHtml(s.extracted?.make || '')} ${escapeHtml(s.extracted?.model || '')}</div>` : ''}
                ${s.serviceRequest ? `<div class="muted">Заявка: ${escapeHtml(s.serviceRequest.status)}</div>` : ''}
              </li>`;
            })
            .join('');

    $('#sessList').querySelectorAll('[data-sid]').forEach((li) => {
      li.addEventListener('click', async () => {
        selectedSessionId = li.dataset.sid;
        const detail = await api(`/consultations/${selectedSessionId}`);
        renderConsultDetail(detail);
      });
    });

    $('#reqList').innerHTML = requests
      .map(
        (r) => `<tr data-id="${r.id}" style="cursor:pointer">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${r.status}</td>
      </tr>`,
      )
      .join('');

    $('#reqList')
      .querySelectorAll('tr')
      .forEach((tr) => {
        tr.addEventListener('click', () => openThread(tr.dataset.id));
      });

    const srSel = $('#bookingServiceRequestId');
    if (srSel) {
      srSel.innerHTML =
        `<option value="">— не привязывать к заявке —</option>` +
        requests.map((r) => `<option value="${r.id}">${r.id.slice(0, 8)}… ${r.status}</option>`).join('');
    }

    reportsCache = reports || [];
    $('#repList').innerHTML =
      reportsCache.length === 0
        ? `<li class="muted">Пока нет сохранённых отчётов. Завершите консультацию и нажмите «Сохранить отчёт».</li>`
        : reportsCache
            .map(
              (r) => `<li class="card" data-rid="${r.id}" style="margin-bottom:0.5rem;cursor:pointer">
        <strong>${formatDate(r.createdAt)}</strong><br>
        ${escapeHtml(r.label || 'без названия')}
      </li>`,
            )
            .join('');

    $('#repList').querySelectorAll('[data-rid]').forEach((li) => {
      li.addEventListener('click', () => {
        selectedReportId = li.dataset.rid;
        const r = reportsCache.find((x) => x.id === selectedReportId);
        renderReportDetail(r);
      });
    });

    $('#bookList').innerHTML = bookings
      .map(
        (b) => `<li class="card" style="margin-bottom:0.5rem">
        ${formatDate(b.preferredAt)} — ${b.status}${b.notes ? `<br><small>${escapeHtml(b.notes)}</small>` : ''}
      </li>`,
      )
      .join('');
  }

  async function openThread(requestId) {
    selectedRequestId = requestId;
    const msgs = await api(`/service-requests/${requestId}/messages`);
    $('#threadTitle').textContent = `Переписка по заявке`;
    $('#threadBody').innerHTML = msgs
      .map(
        (m) => `<div class="bubble bubble--assistant" style="margin-bottom:0.5rem">
        <small>${escapeHtml(m.author?.fullName || '')} (${m.author?.role}) — ${formatDate(m.createdAt)}</small><br>
        ${escapeHtml(m.body)}
      </div>`,
      )
      .join('');

    const detail = await api(`/service-requests/${requestId}`);
    const closed = detail.status === 'COMPLETED' || detail.status === 'CANCELLED';
    $('#threadForm').style.display = closed ? 'none' : 'block';

    const d = $('#reqDetail');
    if (d) {
      d.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
          <strong>Заявка ${escapeHtml(detail.id.slice(0, 8))}…</strong>
          ${badge(detail.status, detail.status === 'COMPLETED' ? 'ok' : detail.status === 'CANCELLED' ? 'warn' : 'ghost')}
        </div>
        <p class="muted" style="margin:0.5rem 0 0.75rem">${formatDate(detail.createdAt)}</p>
        <div class="table-wrap">
          <table class="data">
            <tbody>
              <tr><th>Авто</th><td>${escapeHtml(detail.snapshotMake || '—')} ${escapeHtml(detail.snapshotModel || '')}</td></tr>
              <tr><th>Симптомы</th><td>${escapeHtml(detail.snapshotSymptoms || '—')}</td></tr>
            </tbody>
          </table>
        </div>
        ${
          detail.consultationSession
            ? `<p class="muted" style="margin:0.75rem 0 0">Есть транскрипт ИИ и заполненные данные из консультации.</p>`
            : ''
        }
      `;
    }
  }

  $('#threadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedRequestId) return;
    const body = $('#threadInput').value.trim();
    if (!body) return;
    await api(`/service-requests/${selectedRequestId}/messages`, {
      method: 'POST',
      body: { body },
    });
    $('#threadInput').value = '';
    await openThread(selectedRequestId);
  });

  $('#bookingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dt = fd.get('preferredAt');
    const iso = dt ? new Date(dt).toISOString() : '';
    await api('/bookings', {
      method: 'POST',
      body: {
        preferredAt: iso,
        notes: fd.get('notes') || null,
        serviceRequestId: fd.get('serviceRequestId') || null,
      },
    });
    e.target.reset();
    await refresh();
    await uiAlert({ title: 'Запись отправлена', message: 'Мы получили вашу запись. Статус можно увидеть в разделе «Записи».' });
  });

  async function loadProfile() {
    const me = await api('/users/me');
    $('#pfFullName').value = me.fullName || '';
    $('#pfPhone').value = me.phone || '';
    $('#pfEmailProfile').value = me.emailProfile || '';
  }

  $('#profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#profileMsg');
    try {
      const fullName = $('#pfFullName').value.trim();
      const phone = $('#pfPhone').value.trim();
      const emailProfile = $('#pfEmailProfile').value.trim();
      await api('/users/me', {
        method: 'PATCH',
        body: {
          fullName,
          phone,
          emailProfile: emailProfile ? emailProfile : null,
        },
      });
      if (msg) msg.textContent = 'Изменения сохранены.';
    } catch (err) {
      if (msg) msg.textContent = err.message || 'Не удалось сохранить.';
      await uiAlert({ title: 'Ошибка', message: err.message || 'Не удалось сохранить.' });
    }
  });

  try {
    initTabs();
    await tryClaimPendingGuest();
    await refresh();
    renderConsultDetail(null);
    renderReportDetail(null);
    await loadProfile();
  } catch (e) {
    root.innerHTML = `<p class="alert alert--error">${escapeHtml(e.message)}</p>`;
  }
}
