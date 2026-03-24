import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';

export async function initClientDashboard() {
  const user = requireAuth(['CLIENT']);
  if (!user) return;

  const root = $('#clientRoot');
  let selectedRequestId = null;

  async function refresh() {
    const [sessions, requests, reports, bookings] = await Promise.all([
      api('/consultations'),
      api('/service-requests'),
      api('/users/me/consultation-reports'),
      api('/bookings'),
    ]);

    $('#sessList').innerHTML = sessions
      .map(
        (s) => `<li class="card" style="margin-bottom:0.5rem">
        <strong>${formatDate(s.createdAt)}</strong> — ${s.status}, ${s.progressPercent}%
        ${s.serviceRequest ? `<br>Заявка: ${s.serviceRequest.status}` : ''}
      </li>`,
      )
      .join('');

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

    $('#repList').innerHTML = reports
      .map(
        (r) => `<li class="card" style="margin-bottom:0.5rem">
        ${formatDate(r.createdAt)} — ${escapeHtml(r.label || 'без названия')}
      </li>`,
      )
      .join('');

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
    alert('Запись отправлена.');
  });

  try {
    await refresh();
  } catch (e) {
    root.innerHTML = `<p class="alert alert--error">${escapeHtml(e.message)}</p>`;
  }
}
