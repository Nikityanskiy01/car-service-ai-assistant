import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';

export async function initManagerDashboard() {
  const user = requireAuth(['MANAGER', 'ADMINISTRATOR']);
  if (!user) return;

  let selected = null;
  let selectedId = null;

  // Hide reply form until a request selected.
  try {
    const f = $('#mgrThreadForm');
    if (f) f.style.display = 'none';
  } catch {
    /* ignore */
  }

  function badge(text, tone = 'ghost') {
    const cls =
      tone === 'ok'
        ? 'pill pill--ok'
        : tone === 'warn'
          ? 'pill pill--warn'
          : tone === 'bad'
            ? 'pill pill--bad'
            : 'pill pill--ghost';
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  async function loadList() {
    const q = $('#filterQ').value.trim();
    const st = $('#filterStatus').value;
    const qs = new URLSearchParams();
    if (st) qs.set('status', st);
    if (q) qs.set('q', q);
    const list = await api(`/service-requests?${qs.toString()}`);
    $('#mgrTable tbody').innerHTML = list.length
      ? list
          .map(
            (r) => `<tr data-id="${r.id}" style="cursor:pointer">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.client?.fullName || r.guestName || '')}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${badge(r.status, r.status === 'COMPLETED' ? 'ok' : r.status === 'CANCELLED' ? 'bad' : 'ghost')}</td>
        <td>v${r.version}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="5"><div class="empty">Заявок пока нет. Когда клиент создаст заявку после консультации, она появится здесь.</div></td></tr>`;

    $('#mgrTable tbody').querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.id === selectedId);
      tr.addEventListener('click', () => selectRow(tr.dataset.id));
    });
  }

  async function selectRow(id) {
    selectedId = id;
    selected = await api(`/service-requests/${id}`);
    $('#detailPanel').innerHTML = `
      <h3>Заявка ${selected.id.slice(0, 8)}…</h3>
      <p><strong>Клиент:</strong> ${escapeHtml(selected.client?.fullName || selected.guestName || '—')}<br>
      Тел.: ${escapeHtml(selected.client?.phone || selected.guestPhone || '—')}<br>
      Email: ${escapeHtml(selected.client?.emailProfile || selected.client?.email || selected.guestEmail || '—')}</p>
      <p style="margin:0 0 0.75rem"><strong>Статус:</strong> ${badge(
        selected.status,
        selected.status === 'COMPLETED' ? 'ok' : selected.status === 'CANCELLED' ? 'bad' : 'ghost',
      )} <small>(версия ${selected.version})</small></p>
      <div class="form-field">
        <label>Сменить статус</label>
        <select id="statusSelect">
          ${['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']
            .map((s) => `<option value="${s}" ${s === selected.status ? 'selected' : ''}>${s}</option>`)
            .join('')}
        </select>
      </div>
      <button type="button" class="btn btn--primary" id="saveStatus">Сохранить статус</button>
      <h4>Транскрипт ИИ</h4>
      <div class="chat" style="max-height:220px">
        ${(selected.consultationSession?.messages || []).length
          ? (selected.consultationSession?.messages || [])
              .map(
                (m) =>
                  `<div class="bubble ${m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'}">${escapeHtml(m.content)}</div>`,
              )
              .join('')
          : `<div class="empty">Транскрипта консультации нет (заявка могла быть создана вручную или без ИИ-диалога).</div>`}
      </div>
    `;

    $('#saveStatus').onclick = async () => {
      const status = $('#statusSelect').value;
      try {
        const out = await api(`/service-requests/${id}`, {
          method: 'PATCH',
          body: { status, expectedVersion: selected.version },
        });
        selected.version = out.version;
        selected.status = status;
        await uiAlert({ title: 'Готово', message: 'Статус обновлён.' });
        await loadList();
        await selectRow(id);
      } catch (e) {
        if (e.status === 409) await uiAlert({ title: 'Конфликт', message: 'Конфликт версий — обновите страницу и повторите.' });
        else await uiAlert({ title: 'Ошибка', message: e.message });
      }
    };

    document.querySelectorAll('#mgrTable tbody tr[data-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.id === selectedId);
    });

    const msgs = await api(`/service-requests/${id}/messages`);
    $('#mgrThread').innerHTML = msgs
      .map(
        (m) => `<div class="bubble bubble--assistant" style="margin-bottom:0.5rem">
      <small>${escapeHtml(m.author?.fullName || '')} — ${formatDate(m.createdAt)}</small><br>${escapeHtml(m.body)}
    </div>`,
      )
      .join('');
    if (!msgs.length) {
      $('#mgrThread').innerHTML = `<div class="empty">Сообщений пока нет. Напишите клиенту — он увидит ответ в кабинете.</div>`;
    }

    const form = $('#mgrThreadForm');
    if (form) form.style.display = 'block';

    $('#mgrThreadForm').onsubmit = async (e) => {
      e.preventDefault();
      const body = $('#mgrThreadInput').value.trim();
      if (!body) return;
      await api(`/service-requests/${id}/messages`, { method: 'POST', body: { body } });
      $('#mgrThreadInput').value = '';
      await selectRow(id);
    };
  }

  async function loadBookings() {
    const list = await api('/bookings');
    $('#bookingsMgr').innerHTML = list
      .map(
        (b) => `<li class="card" style="margin-bottom:0.5rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
        <span>${formatDate(b.preferredAt)} — ${escapeHtml(b.client?.fullName || '')} — ${badge(
          b.status,
          b.status === 'CONFIRMED' ? 'ok' : b.status === 'CANCELLED' ? 'bad' : 'ghost',
        )}</span>
        <select data-bid="${b.id}" class="bookingStatus">
          <option value="PENDING" ${b.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
          <option value="CONFIRMED" ${b.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
          <option value="CANCELLED" ${b.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
        </select>
        <button type="button" class="btn btn--primary btn-sm saveBook" data-bid="${b.id}">OK</button>
      </li>`,
      )
      .join('');
    if (!list.length) {
      $('#bookingsMgr').innerHTML = `<li class="empty" style="list-style:none">Записей пока нет.</li>`;
    }

    $('#bookingsMgr').querySelectorAll('.saveBook').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bid;
        const sel = document.querySelector(`select.bookingStatus[data-bid="${id}"]`);
        await api(`/bookings/${id}`, { method: 'PATCH', body: { status: sel.value } });
        await loadBookings();
      });
    });
  }

  $('#filterBtn').addEventListener('click', () => loadList());
  await loadList();
  await loadBookings();
}
