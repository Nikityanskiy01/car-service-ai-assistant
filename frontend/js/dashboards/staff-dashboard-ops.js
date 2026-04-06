import { api, downloadApiFile } from '../api.js';
import { escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';
import { attachBookingListHandlers, renderBookingCardsMarkup } from './booking-staff-ui.js';
import { syncStaffWorkBoard } from './service-requests-kanban.js';
import { syncStaffWorkCalendar } from './staff-work-calendar.js';

/** @typedef {{ [k: string]: string }} OpsIds */

export const MANAGER_OPS_IDS = {
  filterQ: 'filterQ',
  filterStatus: 'filterStatus',
  filterBtn: 'filterBtn',
  requestsTable: 'mgrTable',
  detailPanel: 'detailPanel',
  thread: 'mgrThread',
  threadForm: 'mgrThreadForm',
  threadInput: 'mgrThreadInput',
  contactsTable: 'contactsTable',
  contactsRefreshBtn: 'contactsRefreshBtn',
  bookingsList: 'bookingsMgr',
  consultTable: 'mgrConsultTable',
  consultDetail: 'mgrConsultDetail',
  consultRefreshBtn: 'consultRefreshBtn',
  jumpToRequestBtn: 'staffJumpToRequest',
};

function formatPhoneDigits(d) {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 11 && s[0] === '7') {
    return `+7 (${s.slice(1, 4)}) ${s.slice(4, 7)}-${s.slice(7, 9)}-${s.slice(9)}`;
  }
  if (s.length === 10) return `+7 (${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6, 8)}-${s.slice(8)}`;
  return s ? `+${s}` : '—';
}

/**
 * @param {OpsIds} ids
 * @param {{ requestsTabKey?: string; navigateToTab?: (key: string) => void; staffRole?: 'MANAGER' | 'ADMINISTRATOR' }} nav
 */
export function mountStaffDashboardOperations(ids, nav = {}) {
  const requestsTabKey = nav.requestsTabKey || 'records';
  const navigateToTab = typeof nav.navigateToTab === 'function' ? nav.navigateToTab : () => {};
  const staffRole = nav.staffRole === 'ADMINISTRATOR' ? 'ADMINISTRATOR' : 'MANAGER';

  const $id = (key) => document.getElementById(ids[key] || key);

  function getThreadCardEl() {
    const threadForm = $id('threadForm');
    return threadForm?.closest('.dash-mgr-thread-card') ?? null;
  }

  let selected = null;
  let selectedId = null;
  let selectedConsultId = null;

  let requestsViewMode = 'kanban';
  let requestsListCache = [];
  /** @type {any[]} */
  let bookingsListCache = [];

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

  function refreshBoardViews() {
    const kr = ids.requestsKanbanRoot ? document.getElementById(ids.requestsKanbanRoot) : null;
    const cal = ids.requestsCalendarRoot ? document.getElementById(ids.requestsCalendarRoot) : null;
    if (requestsViewMode === 'kanban' && kr && !kr.hidden) {
      syncStaffWorkBoard(kr, { serviceRequests: requestsListCache, bookings: bookingsListCache }, boardHandlers);
    }
    if (requestsViewMode === 'calendar' && cal && !cal.hidden) {
      syncStaffWorkCalendar(cal, { serviceRequests: requestsListCache, bookings: bookingsListCache }, calHandlers);
    }
  }

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
    const fq = $id('filterQ');
    const fs = $id('filterStatus');
    const tbody = $id('requestsTable')?.querySelector('tbody');
    if (!fq || !fs || !tbody) return;

    const q = fq.value.trim();
    const st = fs.value;
    const qs = new URLSearchParams();
    if (requestsViewMode === 'table' && st) qs.set('status', st);
    if (q) qs.set('q', q);
    /* канбан/календарь: без фильтра статуса — все заявки до 100 */
    qs.set('page', '1');
    qs.set('pageSize', '100');
    qs.set('sort', 'createdAt');
    qs.set('dir', 'desc');
    const res = await api(`/service-requests?${qs.toString()}`);
    const list = Array.isArray(res) ? res : res.items || [];
    requestsListCache = list;
    tbody.innerHTML = list.length
      ? list
          .map(
            (r) => `<tr data-id="${r.id}" class="u-pointer">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.client?.fullName || r.guestName || '')}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${badge(r.status, r.status === 'COMPLETED' ? 'ok' : r.status === 'CANCELLED' ? 'bad' : 'ghost')}</td>
        <td title="Версия записи (служебное поле для синхронизации)">${r.version}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="5"><div class="empty">Заявок пока нет. Когда клиент создаст заявку после консультации, она появится здесь.</div></td></tr>`;

    tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.id === selectedId);
      tr.addEventListener('click', () => selectRow(tr.dataset.id));
    });

    refreshBoardViews();
  }

  async function selectRow(id) {
    const detailPanel = $id('detailPanel');
    const threadEl = $id('thread');
    const threadForm = $id('threadForm');
    const threadInput = $id('threadInput');
    const requestsTable = $id('requestsTable');
    if (!detailPanel || !threadEl || !threadForm || !threadInput || !requestsTable) return;

    selectedId = id;
    selected = await api(`/service-requests/${id}`);
    detailPanel.innerHTML = `
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
      <button type="button" class="btn btn--ghost btn-sm u-mt-sm" id="exportRequestPdfBtn">Скачать PDF</button>
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

    document.getElementById('exportRequestPdfBtn')?.addEventListener('click', async () => {
      try {
        await downloadApiFile(`/service-requests/${id}/export.pdf`);
      } catch (e) {
        await uiAlert({ title: 'Ошибка', message: e.message });
      }
    });

    const saveBtn = document.getElementById('saveStatus');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const statusSelect = document.getElementById('statusSelect');
        const status = statusSelect?.value;
        if (!status) return;
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
    }

    requestsTable.querySelectorAll('tbody tr[data-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.id === selectedId);
    });

    const msgs = await api(`/service-requests/${id}/messages`);
    threadEl.innerHTML = msgs
      .map(
        (m) => `<div class="bubble bubble--assistant dash__thread-msg">
      <small>${escapeHtml(m.author?.fullName || '')} — ${formatDate(m.createdAt)}</small><br>${escapeHtml(m.body)}
    </div>`,
      )
      .join('');
    if (!msgs.length) {
      threadEl.innerHTML = `<div class="empty">Сообщений пока нет. Напишите клиенту — он увидит ответ в кабинете.</div>`;
    }

    const threadCard = getThreadCardEl();
    if (threadCard) threadCard.removeAttribute('hidden');
    threadForm.style.display = 'grid';
    detailPanel.focus({ preventScroll: true });

    threadForm.onsubmit = async (e) => {
      e.preventDefault();
      const body = threadInput.value.trim();
      if (!body) return;
      await api(`/service-requests/${id}/messages`, { method: 'POST', body: { body } });
      threadInput.value = '';
      await selectRow(id);
    };
  }

  async function selectBookingFromBoard(id) {
    selectedId = null;
    selected = null;
    const requestsTable = $id('requestsTable');
    requestsTable?.querySelectorAll('tbody tr[data-id]').forEach((tr) => tr.classList.remove('is-selected'));
    hideThreadSidebarUntilSelect();

    let b = bookingsListCache.find((x) => x.id === id);
    if (!b) {
      await loadBookings();
      b = bookingsListCache.find((x) => x.id === id);
    }
    const detailPanel = $id('detailPanel');
    if (!detailPanel) return;
    if (!b) {
      detailPanel.innerHTML = `<div class="empty">Запись не найдена. Обновите список записей на визит.</div>`;
      return;
    }
    const name = escapeHtml(b.client?.fullName || b.guestName || '—');
    const phone = escapeHtml(formatPhoneDigits(b.client?.phone || b.guestPhone));
    const when = escapeHtml(formatDate(b.preferredAt));
    const st =
      b.status === 'CONFIRMED' ? 'Подтверждена' : b.status === 'CANCELLED' ? 'Отменена' : 'Ожидает подтверждения';
    detailPanel.innerHTML = `
      <h3>Запись на визит</h3>
      <p><strong>Клиент:</strong> ${name}<br>
      Тел.: ${phone}<br>
      <strong>Визит:</strong> ${when}<br>
      <strong>Статус:</strong> ${escapeHtml(st)}</p>
      <p class="muted">Полная форма — в блоке «Записи на визит» ниже.</p>
    `;
    detailPanel.focus({ preventScroll: true });

    requestAnimationFrame(() => {
      const listEl = $id('bookingsList');
      const li = listEl?.querySelector(`li[data-booking-id="${id}"]`);
      if (!li) return;
      const sum = li.querySelector('.dash__booking-summary');
      const bodyEl = li.querySelector('.dash__booking-body');
      if (bodyEl?.hidden && sum) sum.click();
      li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function loadContacts() {
    const table = $id('contactsTable');
    const tbody = table?.querySelector('tbody');
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
    const listEl = $id('bookingsList');
    if (!listEl) return;
    const list = await api('/bookings?limit=100');
    bookingsListCache = Array.isArray(list) ? list : [];
    if (!bookingsListCache.length) {
      listEl.innerHTML = `<li class="empty">Записей пока нет.</li>`;
    } else {
      listEl.innerHTML = renderBookingCardsMarkup(bookingsListCache, staffRole);
      attachBookingListHandlers(listEl, { staffRole, reload: loadBookings });
    }
    refreshBoardViews();
  }

  async function loadConsultationsList() {
    const table = $id('consultTable');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;
    try {
      const cres = await api('/consultations/staff?limit=500');
      const clist = Array.isArray(cres) ? cres : cres.items || [];
      tbody.innerHTML = clist.length
        ? clist
            .map((c) => {
              const name = c.client?.fullName || c.guestName || '—';
              const phone = c.client?.phone || c.guestPhone;
              const car = [c.make, c.model].filter(Boolean).join(' ') || '—';
              const hasSr = !!c.serviceRequest;
              return `<tr data-consult-id="${c.id}" class="u-pointer">
        <td>${formatDate(c.updatedAt)}</td>
        <td>${escapeHtml(name)}${
          phone
            ? `<br><small class="muted">${escapeHtml(formatPhoneDigits(phone))}</small>`
            : ''
        }</td>
        <td>${escapeHtml(car)}</td>
        <td>${badge(consultStatusLabel(c.status), consultStatusTone(c.status))}</td>
        <td>${hasSr ? '<span class="pill pill--ok">есть</span>' : '—'}</td>
      </tr>`;
            })
            .join('')
        : `<tr><td colspan="5"><div class="empty">Сессий пока нет.</div></td></tr>`;

      tbody.querySelectorAll('tr[data-consult-id]').forEach((tr) => {
        tr.classList.toggle('is-selected', tr.dataset.consultId === selectedConsultId);
        tr.addEventListener('click', () => selectConsultSession(tr.dataset.consultId));
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty">${escapeHtml(e.message)}</div></td></tr>`;
    }
  }

  async function selectConsultSession(id) {
    selectedConsultId = id;
    const consultTable = $id('consultTable');
    const detail = $id('consultDetail');
    const jumpId = ids.jumpToRequestBtn || 'staffJumpToRequest';
    if (!consultTable || !detail) return;

    consultTable.querySelectorAll('tbody tr[data-consult-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.consultId === id);
    });

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
      <p><button type="button" class="btn btn--ghost btn-sm" id="exportConsultPdfBtn">Скачать PDF</button></p>
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
          ? `<p><button type="button" class="btn btn--ghost btn-sm" id="${escapeHtml(jumpId)}">Открыть заявку на ремонт</button></p>`
          : ''
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
      const jumpBtn = document.getElementById(jumpId);
      jumpBtn?.addEventListener('click', async () => {
        navigateToTab(requestsTabKey);
        await loadList();
        await loadBookings();
        await selectRow(srId);
      });
      document.getElementById('exportConsultPdfBtn')?.addEventListener('click', async () => {
        try {
          await downloadApiFile(`/consultations/${id}/export.pdf`);
        } catch (e) {
          await uiAlert({ title: 'Ошибка', message: e.message });
        }
      });
      detail.focus({ preventScroll: true });
    } catch (e) {
      detail.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
  }

  function hideThreadSidebarUntilSelect() {
    const threadForm = $id('threadForm');
    if (threadForm) threadForm.style.display = 'none';
    const threadCard = getThreadCardEl();
    if (threadCard) threadCard.setAttribute('hidden', '');
  }

  function onTabShown(key) {
    if (key === 'records') {
      void loadList();
      void loadBookings();
    }
    if (key === 'contacts') void loadContacts();
    if (key === 'consultations') void loadConsultationsList();
  }

  function bindFilters() {
    const btn = $id('filterBtn');
    btn?.addEventListener('click', () => loadList());
    $id('filterStatus')?.addEventListener('change', () => {
      if (requestsViewMode === 'table') void loadList();
    });
    $id('filterQ')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void loadList();
      }
    });
    $id('contactsRefreshBtn')?.addEventListener('click', () => loadContacts());
    $id('consultRefreshBtn')?.addEventListener('click', () => loadConsultationsList());
  }

  function bindRequestsViewToggle() {
    const toggleRootId = ids.requestsViewToggle;
    if (!toggleRootId) return;
    const root = document.getElementById(toggleRootId);
    if (!root) return;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sr-view]');
      if (!btn) return;
      const mode = btn.getAttribute('data-sr-view') || 'kanban';
      requestsViewMode = mode === 'table' ? 'table' : mode === 'calendar' ? 'calendar' : 'kanban';
      root.querySelectorAll('[data-sr-view]').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-sr-view') === mode);
      });
      const tw = ids.requestsTableWrap ? document.getElementById(ids.requestsTableWrap) : null;
      const kr = ids.requestsKanbanRoot ? document.getElementById(ids.requestsKanbanRoot) : null;
      const cal = ids.requestsCalendarRoot ? document.getElementById(ids.requestsCalendarRoot) : null;
      if (tw) tw.hidden = requestsViewMode !== 'table';
      if (kr) kr.hidden = requestsViewMode !== 'kanban';
      if (cal) cal.hidden = requestsViewMode !== 'calendar';
      const fs = $id('filterStatus');
      if (fs) {
        const off = requestsViewMode === 'kanban' || requestsViewMode === 'calendar';
        fs.disabled = off;
        fs.title = off
          ? 'В канбане и календаре — все статусы (до 100 заявок). Фильтр только в таблице.'
          : '';
      }
      void loadList();
    });
  }

  hideThreadSidebarUntilSelect();
  bindRequestsViewToggle();
  bindFilters();

  const fs0 = $id('filterStatus');
  if (fs0 && (requestsViewMode === 'kanban' || requestsViewMode === 'calendar')) {
    fs0.disabled = true;
    fs0.title = 'В канбане и календаре — все статусы (до 100 заявок). Фильтр только в таблице.';
  }

  return {
    loadList,
    loadBookings,
    loadContacts,
    loadConsultationsList,
    onTabShown,
  };
}
