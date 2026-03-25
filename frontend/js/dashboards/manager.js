import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';

export async function initManagerDashboard() {
  const user = requireAuth(['MANAGER', 'ADMINISTRATOR']);
  if (!user) return;

  let selected = null;

  async function loadList() {
    const q = $('#filterQ').value.trim();
    const st = $('#filterStatus').value;
    const qs = new URLSearchParams();
    if (st) qs.set('status', st);
    if (q) qs.set('q', q);
    const list = await api(`/service-requests?${qs.toString()}`);
    $('#mgrTable tbody').innerHTML = list
      .map(
        (r) => `<tr data-id="${r.id}" style="cursor:pointer">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.client?.fullName || '')}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${r.status}</td>
        <td>v${r.version}</td>
      </tr>`,
      )
      .join('');
    $('#mgrTable tbody').querySelectorAll('tr').forEach((tr) => {
      tr.addEventListener('click', () => selectRow(tr.dataset.id));
    });
  }

  async function selectRow(id) {
    selected = await api(`/service-requests/${id}`);
    $('#detailPanel').innerHTML = `
      <h3>Заявка ${selected.id.slice(0, 8)}…</h3>
      <p><strong>Клиент:</strong> ${escapeHtml(selected.client?.fullName || '')}<br>
      Тел.: ${escapeHtml(selected.client?.phone || '')}<br>
      Email: ${escapeHtml(selected.client?.emailProfile || selected.client?.email || '')}</p>
      <p><strong>Статус:</strong> ${selected.status} <small>(версия ${selected.version})</small></p>
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
        ${(selected.consultationSession?.messages || [])
          .map(
            (m) =>
              `<div class="bubble ${m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'}">${escapeHtml(m.content)}</div>`,
          )
          .join('')}
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

    const msgs = await api(`/service-requests/${id}/messages`);
    $('#mgrThread').innerHTML = msgs
      .map(
        (m) => `<div class="bubble bubble--assistant" style="margin-bottom:0.5rem">
      <small>${escapeHtml(m.author?.fullName || '')} — ${formatDate(m.createdAt)}</small><br>${escapeHtml(m.body)}
    </div>`,
      )
      .join('');

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
        <span>${formatDate(b.preferredAt)} — ${escapeHtml(b.client?.fullName || '')} — ${b.status}</span>
        <select data-bid="${b.id}" class="bookingStatus">
          <option value="PENDING" ${b.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
          <option value="CONFIRMED" ${b.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
          <option value="CANCELLED" ${b.status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
        </select>
        <button type="button" class="btn btn--primary btn-sm saveBook" data-bid="${b.id}">OK</button>
      </li>`,
      )
      .join('');

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
