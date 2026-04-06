import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';
import { attachBookingListHandlers, renderBookingCardsMarkup } from './booking-staff-ui.js';
import { syncStaffWorkBoard } from './service-requests-kanban.js';
import { syncStaffWorkCalendar } from './staff-work-calendar.js';

function formatPhoneDigits(d) {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 11 && s[0] === '7') {
    return `+7 (${s.slice(1, 4)}) ${s.slice(4, 7)}-${s.slice(7, 9)}-${s.slice(9)}`;
  }
  if (s.length === 10) return `+7 (${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6, 8)}-${s.slice(8)}`;
  return s ? `+${s}` : '—';
}

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

function toggleSortState(prev, key, descDefaultKeys) {
  if (prev.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: descDefaultKeys.has(key) ? 'desc' : 'asc' };
}

const CONSULT_SORT_DESC_DEFAULT = new Set(['updatedAt', 'hasRequest']);
const REQUESTS_SORT_DESC_DEFAULT = new Set(['createdAt', 'version']);

function consultClientKey(c) {
  return (c.client?.fullName || c.guestName || '').trim() || '\uffff';
}

function consultCarKey(c) {
  return [c.make, c.model].filter(Boolean).join(' ').trim() || '\uffff';
}

function sortConsultList(raw, { key, dir }) {
  const mul = dir === 'asc' ? 1 : -1;
  return [...raw].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'updatedAt':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'client':
        cmp = collator.compare(consultClientKey(a), consultClientKey(b));
        break;
      case 'car':
        cmp = collator.compare(consultCarKey(a), consultCarKey(b));
        break;
      case 'status':
        cmp = collator.compare(String(a.status), String(b.status));
        break;
      case 'hasRequest': {
        const va = a.serviceRequest ? 1 : 0;
        const vb = b.serviceRequest ? 1 : 0;
        cmp = va - vb;
        break;
      }
      default:
        cmp = 0;
    }
    return mul * cmp;
  });
}

export async function initManagerDashboard() {
  const user = requireAuth(['MANAGER', 'ADMINISTRATOR']);
  if (!user) return;

  let selected = null;
  let selectedId = null;
  let selectedConsultId = null;

  let consultListCache = null;
  let consultSort = { key: 'updatedAt', dir: 'desc' };

  let requestsListCache = [];
  /** @type {any[]} */
  let bookingsListCache = [];
  let requestsViewMode = 'kanban';
  let requestsSort = { key: 'createdAt', dir: 'desc' };
  let consultGrandTotal = 0;
  let consultPage = 1;
  let consultPageSize = 15;
  let requestsTotal = 0;
  let requestsPage = 1;
  let requestsPageSize = 15;

  let activateTab = () => {};

  function consultStatusLabel(st) {
    const map = {
      IN_PROGRESS: 'В работе',
      COMPLETED: 'Завершена',
      ABANDONED: 'Прервана',
      AI_ERROR: 'Ошибка ИИ',
    };
    return map[st] || st;
  }

  function consultStatusTone(st) {
    if (st === 'COMPLETED') return 'ok';
    if (st === 'ABANDONED' || st === 'AI_ERROR') return 'bad';
    return 'ghost';
  }

  try {
    const f = $('#mgrThreadForm');
    if (f) f.style.display = 'none';
    document.getElementById('mgrThreadCard')?.setAttribute('hidden', '');
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

  function updateConsultSortUi() {
    $('#mgrConsultTable')?.querySelectorAll('.dash-mgr-sort').forEach((btn) => {
      const key = btn.dataset.sortKey;
      const active = consultSort.key === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      const ico = btn.querySelector('.dash-mgr-sort__ico');
      if (!ico) return;
      if (active) {
        btn.setAttribute('aria-sort', consultSort.dir === 'asc' ? 'ascending' : 'descending');
        ico.textContent = consultSort.dir === 'asc' ? '↑' : '↓';
      } else {
        btn.removeAttribute('aria-sort');
        ico.textContent = '';
      }
    });
  }

  function updateRequestsSortUi() {
    $('#mgrTable')?.querySelectorAll('.dash-mgr-sort').forEach((btn) => {
      const key = btn.dataset.sortKey;
      const active = requestsSort.key === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      const ico = btn.querySelector('.dash-mgr-sort__ico');
      if (!ico) return;
      if (active) {
        btn.setAttribute('aria-sort', requestsSort.dir === 'asc' ? 'ascending' : 'descending');
        ico.textContent = requestsSort.dir === 'asc' ? '↑' : '↓';
      } else {
        btn.removeAttribute('aria-sort');
        ico.textContent = '';
      }
    });
  }

  function renderConsultPager() {
    const el = $('#consultPager');
    const note = $('#consultLoadNote');
    if (!el) return;
    if (consultListCache == null) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    if (note) {
      if (consultGrandTotal > consultListCache.length) {
        note.hidden = false;
        note.textContent = `В базе ${consultGrandTotal} сессий; для таблицы загружено ${consultListCache.length} (не больше 500 за запрос).`;
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    }
    const sorted = sortConsultList(consultListCache, consultSort);
    const n = sorted.length;
    const pages = Math.max(1, Math.ceil(n / consultPageSize));
    if (consultPage > pages) consultPage = pages;
    if (n === 0) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const start = (consultPage - 1) * consultPageSize;
    const from = start + 1;
    const to = start + Math.min(consultPageSize, n - start);
    el.innerHTML = `
      <div class="dash-mgr-pager__info muted">Строки ${from}–${to} из ${n}</div>
      <div class="dash-mgr-pager__nav">
        <button type="button" class="btn btn--ghost btn-sm" data-consult-page="prev" ${consultPage <= 1 ? 'disabled' : ''}>Назад</button>
        <span class="dash-mgr-pager__meta">Стр. ${consultPage} / ${pages}</span>
        <button type="button" class="btn btn--ghost btn-sm" data-consult-page="next" ${consultPage >= pages ? 'disabled' : ''}>Вперёд</button>
      </div>
      <label class="dash-mgr-pager__size">По
        <select id="consultPageSizeSel">
          <option value="10" ${consultPageSize === 10 ? 'selected' : ''}>10</option>
          <option value="15" ${consultPageSize === 15 ? 'selected' : ''}>15</option>
          <option value="25" ${consultPageSize === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${consultPageSize === 50 ? 'selected' : ''}>50</option>
        </select>
      </label>
    `;
  }

  function renderConsultTable() {
    const tbody = document.querySelector('#mgrConsultTable tbody');
    if (!tbody || consultListCache == null) return;
    const sorted = sortConsultList(consultListCache, consultSort);
    const n = sorted.length;
    const pages = Math.max(1, Math.ceil(n / consultPageSize));
    if (consultPage > pages) consultPage = pages;
    const start = (consultPage - 1) * consultPageSize;
    const pageRows = sorted.slice(start, start + consultPageSize);

    tbody.innerHTML = pageRows.length
      ? pageRows
          .map((c) => {
            const name = c.client?.fullName || c.guestName || '—';
            const phone = c.client?.phone || c.guestPhone;
            const car = [c.make, c.model].filter(Boolean).join(' ') || '—';
            const srId = c.serviceRequest?.id;
            const reqCell = srId
              ? `<div class="dash-mgr-repair-cell"><span class="pill pill--ok" title="После консультации клиент оформил заявку на ремонт">Оформлена</span><button type="button" class="btn btn--ghost btn-sm mgr-sr-link" data-action="open-sr" data-sr-id="${escapeHtml(srId)}">К заявке</button></div>`
              : '<span class="muted" title="Клиент ещё не создал заявку на ремонт после этой консультации">нет</span>';
            const sel = c.id === selectedConsultId ? ' is-selected' : '';
            return `<tr data-consult-id="${c.id}" class="u-pointer${sel}">
        <td>${formatDate(c.updatedAt)}</td>
        <td>${escapeHtml(name)}${
          phone
            ? `<br><small class="muted">${escapeHtml(formatPhoneDigits(phone))}</small>`
            : ''
        }</td>
        <td>${escapeHtml(car)}</td>
        <td>${badge(consultStatusLabel(c.status), consultStatusTone(c.status))}</td>
        <td class="dash-mgr-col--narrow">${reqCell}</td>
        <td class="dash-mgr-actions"><button type="button" class="btn btn--primary btn-sm" data-action="open-consult" data-consult-id="${c.id}">Открыть</button></td>
      </tr>`;
          })
          .join('')
      : `<tr><td colspan="6"><div class="empty">Сессий пока нет.</div></td></tr>`;
    updateConsultSortUi();
    renderConsultPager();
  }

  function renderRequestsPager() {
    const el = $('#requestsPager');
    if (!el) return;
    if (requestsTotal === 0) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const pages = Math.max(1, Math.ceil(requestsTotal / requestsPageSize));
    const from = (requestsPage - 1) * requestsPageSize + 1;
    const to = Math.min(requestsPage * requestsPageSize, requestsTotal);
    el.innerHTML = `
      <div class="dash-mgr-pager__info muted">Записи ${from}–${to} из ${requestsTotal}</div>
      <div class="dash-mgr-pager__nav">
        <button type="button" class="btn btn--ghost btn-sm" data-req-page="prev" ${requestsPage <= 1 ? 'disabled' : ''}>Назад</button>
        <span class="dash-mgr-pager__meta">Стр. ${requestsPage} / ${pages}</span>
        <button type="button" class="btn btn--ghost btn-sm" data-req-page="next" ${requestsPage >= pages ? 'disabled' : ''}>Вперёд</button>
      </div>
      <label class="dash-mgr-pager__size">По
        <select id="requestsPageSizeSel">
          <option value="10" ${requestsPageSize === 10 ? 'selected' : ''}>10</option>
          <option value="15" ${requestsPageSize === 15 ? 'selected' : ''}>15</option>
          <option value="25" ${requestsPageSize === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${requestsPageSize === 50 ? 'selected' : ''}>50</option>
        </select>
      </label>
    `;
  }

  function renderRequestsTable() {
    const tbody = document.querySelector('#mgrTable tbody');
    if (!tbody) return;
    tbody.innerHTML = requestsListCache.length
      ? requestsListCache
          .map(
            (r) => `<tr data-id="${r.id}" class="u-pointer${r.id === selectedId ? ' is-selected' : ''}">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.client?.fullName || r.guestName || '')}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${badge(r.status, r.status === 'COMPLETED' ? 'ok' : r.status === 'CANCELLED' ? 'bad' : 'ghost')}</td>
        <td title="Версия записи (служебное поле для синхронизации)">${r.version}</td>
        <td class="dash-mgr-actions"><button type="button" class="btn btn--primary btn-sm" data-action="open-request" data-id="${r.id}">Открыть</button></td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="6"><div class="empty">Заявок пока нет. Когда клиент создаст заявку после консультации, она появится здесь.</div></td></tr>`;
    updateRequestsSortUi();
    if (requestsViewMode === 'kanban' || requestsViewMode === 'calendar') {
      const pg = $('#requestsPager');
      if (pg) pg.hidden = true;
    } else {
      renderRequestsPager();
    }
  }

  function refreshBoardViews() {
    const kr = document.getElementById('mgrSrKanban');
    const cal = document.getElementById('mgrSrCalendar');
    if (requestsViewMode === 'kanban' && kr && !kr.hidden) {
      syncStaffWorkBoard(kr, { serviceRequests: requestsListCache, bookings: bookingsListCache }, boardHandlers);
    }
    if (requestsViewMode === 'calendar' && cal && !cal.hidden) {
      syncStaffWorkCalendar(cal, { serviceRequests: requestsListCache, bookings: bookingsListCache }, calHandlers);
    }
  }

  const boardHandlers = {
    selectServiceRequest: (rid) => {
      void selectRow(rid);
    },
    selectBooking: (bid) => {
      void selectBookingFromBoard(bid);
    },
    patchServiceRequest: (rid, status, expectedVersion) =>
      api(`/service-requests/${rid}`, { method: 'PATCH', body: { status, expectedVersion } }),
    patchBookingStatus: (bid, status) => api(`/bookings/${bid}`, { method: 'PATCH', body: { status } }),
    reload: async () => {
      await loadList();
      await loadBookings();
    },
  };

  const calHandlers = {
    selectServiceRequest: (rid) => {
      void selectRow(rid);
    },
    selectBooking: (bid) => {
      void selectBookingFromBoard(bid);
    },
    rerender: () => refreshBoardViews(),
  };

  async function loadList(options = {}) {
    if (options.resetPage) requestsPage = 1;
    const q = $('#filterQ').value.trim();
    const st = $('#filterStatus').value;
    const qs = new URLSearchParams();
    const boardMode = requestsViewMode === 'kanban' || requestsViewMode === 'calendar';

    if (boardMode) {
      if (q) qs.set('q', q);
      qs.set('page', '1');
      qs.set('pageSize', '100');
      qs.set('sort', 'createdAt');
      qs.set('dir', 'desc');
    } else {
      if (st) qs.set('status', st);
      if (q) qs.set('q', q);
      qs.set('page', String(requestsPage));
      qs.set('pageSize', String(requestsPageSize));
      qs.set('sort', requestsSort.key);
      qs.set('dir', requestsSort.dir);
    }

    const res = await api(`/service-requests?${qs.toString()}`);
    requestsListCache = Array.isArray(res) ? res : res.items || [];
    requestsTotal = Array.isArray(res) ? res.length : typeof res.total === 'number' ? res.total : requestsListCache.length;
    renderRequestsTable();
    refreshBoardViews();
  }

  async function jumpToServiceRequest(srId) {
    activateTab('records');
    requestsPageSize = 100;
    requestsPage = 1;
    await loadList();
    await selectRow(srId);
  }

  async function selectRow(id) {
    selectedId = id;
    selected = await api(`/service-requests/${id}`);
    $('#detailPanel').innerHTML = `
      <h3>Заявка ${selected.id.slice(0, 8)}…</h3>
      <p><strong>Клиент:</strong> ${escapeHtml(selected.client?.fullName || selected.guestName || '—')}<br>
      Тел.: ${escapeHtml(selected.client?.phone || selected.guestPhone || '—')}<br>
      Email: ${escapeHtml(selected.client?.emailProfile || selected.client?.email || selected.guestEmail || '—')}</p>
      <p class="dash__req-status"><strong>Статус:</strong> ${badge(
        selected.status,
        selected.status === 'COMPLETED' ? 'ok' : selected.status === 'CANCELLED' ? 'bad' : 'ghost',
      )} <small>(версия ${selected.version})</small></p>
      <div class="form-field">
        <label>Сменить статус</label>
        <select id="statusSelect">
          ${[
            ['NEW', 'Новая'],
            ['IN_PROGRESS', 'В работе'],
            ['SCHEDULED', 'Запланирована'],
            ['COMPLETED', 'Завершена'],
            ['CANCELLED', 'Отменена'],
          ]
            .map(
              ([val, label]) =>
                `<option value="${val}" ${val === selected.status ? 'selected' : ''}>${escapeHtml(label)}</option>`,
            )
            .join('')}
        </select>
      </div>
      <button type="button" class="btn btn--primary" id="saveStatus">Сохранить статус</button>
      <h4>Транскрипт ИИ</h4>
      <div class="chat dash__chat--mini">
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

    renderRequestsTable();

    const msgs = await api(`/service-requests/${id}/messages`);
    $('#mgrThread').innerHTML = msgs
      .map(
        (m) => `<div class="bubble bubble--assistant dash__thread-msg">
      <small>${escapeHtml(m.author?.fullName || '')} — ${formatDate(m.createdAt)}</small><br>${escapeHtml(m.body)}
    </div>`,
      )
      .join('');
    if (!msgs.length) {
      $('#mgrThread').innerHTML = `<div class="empty">Сообщений пока нет. Напишите клиенту — он увидит ответ в кабинете.</div>`;
    }

    const form = $('#mgrThreadForm');
    if (form) form.style.display = 'grid';
    document.getElementById('mgrThreadCard')?.removeAttribute('hidden');

    $('#detailPanel')?.focus({ preventScroll: true });
    $('#detailPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    $('#mgrThreadForm').onsubmit = async (e) => {
      e.preventDefault();
      const body = $('#mgrThreadInput').value.trim();
      if (!body) return;
      await api(`/service-requests/${id}/messages`, { method: 'POST', body: { body } });
      $('#mgrThreadInput').value = '';
      await selectRow(id);
    };
  }

  async function selectBookingFromBoard(id) {
    selectedId = null;
    selected = null;
    renderRequestsTable();
    document.getElementById('mgrThreadCard')?.setAttribute('hidden', '');
    const tf = $('#mgrThreadForm');
    if (tf) tf.style.display = 'none';

    let b = bookingsListCache.find((x) => x.id === id);
    if (!b) {
      await loadBookings();
      b = bookingsListCache.find((x) => x.id === id);
    }
    if (!b) {
      $('#detailPanel').innerHTML = `<div class="empty">Запись не найдена. Нажмите «Обновить» в списке записей.</div>`;
      return;
    }
    const name = escapeHtml(b.client?.fullName || b.guestName || '—');
    const phone = escapeHtml(formatPhoneDigits(b.client?.phone || b.guestPhone));
    const when = escapeHtml(formatDate(b.preferredAt));
    const st =
      b.status === 'CONFIRMED' ? 'Подтверждена' : b.status === 'CANCELLED' ? 'Отменена' : 'Ожидает подтверждения';
    $('#detailPanel').innerHTML = `
      <h3>Запись на визит</h3>
      <p><strong>Клиент:</strong> ${name}<br>
      Тел.: ${phone}<br>
      <strong>Визит:</strong> ${when}<br>
      <strong>Статус:</strong> ${escapeHtml(st)}</p>
      <p class="muted">Редактирование — в блоке «Записи на визит» ниже; карточка откроется автоматически.</p>
    `;
    $('#detailPanel')?.focus({ preventScroll: true });

    requestAnimationFrame(() => {
      const li = document.querySelector(`li[data-booking-id="${id}"]`);
      if (!li) return;
      const sum = li.querySelector('.dash__booking-summary');
      const bodyEl = li.querySelector('.dash__booking-body');
      if (bodyEl?.hidden && sum) sum.click();
      li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function loadContacts() {
    const tbody = document.querySelector('#contactsTable tbody');
    if (!tbody) return;
    try {
      const list = await api('/contact');
      tbody.innerHTML = list.length
        ? list
            .map(
              (c) => `<tr>
          <td>${formatDate(c.createdAt)}</td>
          <td>${escapeHtml(c.fullName || '')}</td>
          <td>${escapeHtml(formatPhoneDigits(c.phone))}</td>
          <td class="dash__contacts-msg">${escapeHtml(c.message || '—')}</td>
        </tr>`,
            )
            .join('')
        : `<tr><td colspan="4"><div class="empty">Пока нет обращений с формы на странице контактов.</div></td></tr>`;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty">${escapeHtml(e.message)}</div></td></tr>`;
    }
  }

  async function loadBookings() {
    const listEl = $('#bookingsMgr');
    const list = await api('/bookings?limit=100');
    bookingsListCache = Array.isArray(list) ? list : [];
    if (!bookingsListCache.length) {
      listEl.innerHTML = `<li class="empty">Записей пока нет.</li>`;
    } else {
      listEl.innerHTML = renderBookingCardsMarkup(bookingsListCache, 'MANAGER');
      attachBookingListHandlers(listEl, { staffRole: 'MANAGER', reload: loadBookings });
    }
    refreshBoardViews();
  }

  async function loadConsultationsList() {
    const tbody = document.querySelector('#mgrConsultTable tbody');
    if (!tbody) return;
    try {
      consultPage = 1;
      const res = await api('/consultations/staff?limit=500');
      consultListCache = Array.isArray(res) ? res : res.items || [];
      consultGrandTotal = Array.isArray(res)
        ? res.length
        : typeof res.total === 'number'
          ? res.total
          : consultListCache.length;
      renderConsultTable();
    } catch (e) {
      consultListCache = null;
      consultGrandTotal = 0;
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty">${escapeHtml(e.message)}</div></td></tr>`;
      const pg = $('#consultPager');
      if (pg) {
        pg.hidden = true;
        pg.innerHTML = '';
      }
      const note = $('#consultLoadNote');
      if (note) note.hidden = true;
    }
  }

  async function selectConsultSession(id) {
    selectedConsultId = id;
    renderConsultTable();
    const detail = $('#mgrConsultDetail');
    try {
      const s = await api(`/consultations/${id}`);
      const clientLabel = s.client
        ? `${escapeHtml(s.client.fullName || '—')}${
            s.client.phone ? ` · ${escapeHtml(formatPhoneDigits(s.client.phone))}` : ''
          }`
        : `${escapeHtml(s.guestName || 'Гость')}${
            s.guestPhone ? ` · ${escapeHtml(formatPhoneDigits(s.guestPhone))}` : ''
          }`;
      const srId = s.serviceRequest?.id;
      detail.innerHTML = `
      <h3>Сессия ${escapeHtml(id.slice(0, 8))}…</h3>
      <p><strong>Клиент:</strong> ${clientLabel}<br>
      <strong>Статус:</strong> ${badge(consultStatusLabel(s.status), consultStatusTone(s.status))}
      <span class="muted"> · прогресс ${escapeHtml(String(s.progressPercent ?? 0))}%</span></p>
      ${
        s.serviceCategory?.name
          ? `<p class="muted">Категория: ${escapeHtml(s.serviceCategory.name)}</p>`
          : ''
      }
      ${
        srId
          ? `<p><button type="button" class="btn btn--ghost btn-sm" id="mgrJumpToRequest">Открыть заявку на ремонт</button></p>`
          : '<p class="muted"><small>Заявка на ремонт в сервис ещё не создана. В таблице колонка «Ремонт» = «нет», пока клиент не оформит заявку после консультации.</small></p>'
      }
      <h4>Диалог</h4>
      <div class="chat dash__chat--mini">
        ${
          (s.messages || []).length
            ? (s.messages || [])
                .map(
                  (m) =>
                    `<div class="bubble ${
                      m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'
                    }">${escapeHtml(m.content)}</div>`,
                )
                .join('')
            : '<div class="empty">Нет сообщений.</div>'
        }
      </div>
      <h4>Извлечённые данные</h4>
      <ul class="u-list-reset muted dash__consult-extracted">
        <li>Марка / модель: ${escapeHtml([s.extracted?.make, s.extracted?.model].filter(Boolean).join(' ') || '—')}</li>
        <li>Год: ${escapeHtml(s.extracted?.year != null ? String(s.extracted.year) : '—')}</li>
        <li>Пробег: ${escapeHtml(s.extracted?.mileage != null ? String(s.extracted.mileage) : '—')}</li>
        <li>Симптомы: ${escapeHtml(s.extracted?.symptoms || '—')}</li>
        <li>Условия: ${escapeHtml(s.extracted?.problemConditions || '—')}</li>
      </ul>
      <p class="muted"><small>Ответить клиенту в этом чате нельзя — используйте переписку по заявке на ремонт.</small></p>
    `;
      $('#mgrJumpToRequest')?.addEventListener('click', () => {
        void jumpToServiceRequest(srId);
      });
      detail.focus({ preventScroll: true });
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      detail.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  }

  const tabs = document.querySelectorAll('.dash__tab[data-tab]');
  const panels = document.querySelectorAll('.dash__panel[data-panel]');

  function setActiveTab(key) {
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === key));
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== key;
    });
    if (key) history.replaceState(null, '', '#' + key);
    if (key === 'records') {
      void loadList();
      void loadBookings();
    }
    if (key === 'contacts') void loadContacts();
    if (key === 'consultations') void loadConsultationsList();
  }

  activateTab = setActiveTab;

  tabs.forEach((t) => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));

  $('#mgrConsultTable thead')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dash-mgr-sort');
    if (!btn || !$('#mgrConsultTable thead')?.contains(btn)) return;
    e.preventDefault();
    consultSort = toggleSortState(consultSort, btn.dataset.sortKey, CONSULT_SORT_DESC_DEFAULT);
    consultPage = 1;
    renderConsultTable();
  });

  $('#mgrTable thead')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dash-mgr-sort');
    if (!btn || !$('#mgrTable thead')?.contains(btn)) return;
    e.preventDefault();
    requestsSort = toggleSortState(requestsSort, btn.dataset.sortKey, REQUESTS_SORT_DESC_DEFAULT);
    void loadList({ resetPage: true });
  });

  $('#consultPager')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-consult-page]');
    if (!t || t.disabled || consultListCache == null) return;
    const sorted = sortConsultList(consultListCache, consultSort);
    const pages = Math.max(1, Math.ceil(sorted.length / consultPageSize));
    if (t.dataset.consultPage === 'prev' && consultPage > 1) {
      consultPage -= 1;
      renderConsultTable();
    }
    if (t.dataset.consultPage === 'next' && consultPage < pages) {
      consultPage += 1;
      renderConsultTable();
    }
  });
  $('#consultPager')?.addEventListener('change', (e) => {
    const sel = e.target;
    if (sel && sel.id === 'consultPageSizeSel') {
      consultPageSize = Number(sel.value);
      consultPage = 1;
      renderConsultTable();
    }
  });

  $('#requestsPager')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-req-page]');
    if (!t || t.disabled) return;
    const pages = Math.max(1, Math.ceil(requestsTotal / requestsPageSize));
    if (t.dataset.reqPage === 'prev' && requestsPage > 1) {
      requestsPage -= 1;
      void loadList();
    }
    if (t.dataset.reqPage === 'next' && requestsPage < pages) {
      requestsPage += 1;
      void loadList();
    }
  });
  $('#requestsPager')?.addEventListener('change', (e) => {
    const sel = e.target;
    if (sel && sel.id === 'requestsPageSizeSel') {
      requestsPageSize = Number(sel.value);
      requestsPage = 1;
      void loadList();
    }
  });

  $('#mgrConsultTable')?.addEventListener('click', (e) => {
    const sr = e.target.closest('[data-action="open-sr"]');
    if (sr) {
      e.preventDefault();
      e.stopPropagation();
      void jumpToServiceRequest(sr.dataset.srId);
      return;
    }
    const open = e.target.closest('[data-action="open-consult"]');
    if (open) {
      e.preventDefault();
      void selectConsultSession(open.dataset.consultId);
      return;
    }
    const tr = e.target.closest('tr[data-consult-id]');
    if (tr) void selectConsultSession(tr.dataset.consultId);
  });

  $('#mgrTable')?.addEventListener('click', (e) => {
    const ob = e.target.closest('[data-action="open-request"]');
    if (ob) {
      e.preventDefault();
      void selectRow(ob.dataset.id);
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) void selectRow(tr.dataset.id);
  });

  const LEGACY_TAB_HASH = { requests: 'records', bookings: 'records' };
  const rawHash = location.hash.replace('#', '');
  const hash = LEGACY_TAB_HASH[rawHash] || rawHash;
  if (hash && document.querySelector(`[data-panel="${hash}"]`)) {
    setActiveTab(hash);
  }

  document.getElementById('mgrSrViewToggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sr-view]');
    if (!btn) return;
    const mode = btn.getAttribute('data-sr-view') || 'kanban';
    requestsViewMode = mode === 'table' ? 'table' : mode === 'calendar' ? 'calendar' : 'kanban';
    const root = document.getElementById('mgrSrViewToggle');
    root?.querySelectorAll('[data-sr-view]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-sr-view') === mode);
    });
    const tw = document.getElementById('mgrSrTableWrap');
    if (tw) tw.hidden = requestsViewMode !== 'table';
    const kr = document.getElementById('mgrSrKanban');
    if (kr) kr.hidden = requestsViewMode !== 'kanban';
    const cal = document.getElementById('mgrSrCalendar');
    if (cal) cal.hidden = requestsViewMode !== 'calendar';
    const fs = $('#filterStatus');
    if (fs) {
      const boardOff = requestsViewMode === 'kanban' || requestsViewMode === 'calendar';
      fs.disabled = boardOff;
      fs.title = boardOff
        ? 'В канбане и календаре — до 100 заявок, все статусы. Фильтр по статусу только в таблице.'
        : '';
    }
    void loadList({ resetPage: true });
  });

  $('#filterBtn')?.addEventListener('click', () => loadList({ resetPage: true }));
  $('#filterStatus')?.addEventListener('change', () => {
    if (requestsViewMode === 'table') void loadList({ resetPage: true });
  });
  $('#filterQ')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void loadList({ resetPage: true });
    }
  });
  document.getElementById('contactsRefreshBtn')?.addEventListener('click', () => loadContacts());
  document.getElementById('consultRefreshBtn')?.addEventListener('click', () => loadConsultationsList());

  const fsInit = $('#filterStatus');
  if (fsInit && (requestsViewMode === 'kanban' || requestsViewMode === 'calendar')) {
    fsInit.disabled = true;
    fsInit.title =
      'В канбане и календаре — до 100 заявок, все статусы. Фильтр по статусу только в таблице.';
  }

  await loadList();
  await loadBookings();
  const h = LEGACY_TAB_HASH[rawHash] || rawHash;
  if (h === 'contacts') await loadContacts();
  if (h === 'consultations') await loadConsultationsList();
}
