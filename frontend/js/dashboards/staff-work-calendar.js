import { escapeHtml, formatDate } from '../utils.js';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return localYmd(d);
}

function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

function monthGridCells(year, month0) {
  const firstWd = (new Date(year, month0, 1).getDay() + 6) % 7;
  const dim = daysInMonth(year, month0);
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push({ type: 'pad' });
  for (let d = 1; d <= dim; d++) cells.push({ type: 'day', d });
  while (cells.length % 7 !== 0) cells.push({ type: 'pad' });
  return cells;
}

function eventSortKey(ev) {
  if (ev.kind === 'booking') return new Date(ev.b.preferredAt).getTime();
  return new Date(ev.r.createdAt).getTime();
}

/**
 * @param {HTMLElement | null} root
 * @param {{ serviceRequests: any[]; bookings: any[] }} data
 * @param {{
 *   selectServiceRequest: (id: string) => void;
 *   selectBooking: (id: string) => void;
 *   rerender: () => void;
 * }} handlers
 */
export function syncStaffWorkCalendar(root, data, handlers) {
  if (!root) return;

  let y = Number.parseInt(String(root.dataset.calYear || ''), 10);
  let m = Number.parseInt(String(root.dataset.calMonth || ''), 10);
  if (!Number.isFinite(y)) y = new Date().getFullYear();
  if (!Number.isFinite(m) || m < 0 || m > 11) m = new Date().getMonth();

  const { serviceRequests = [], bookings = [] } = data;
  /** @type {Map<string, { kind: 'sr' | 'booking'; r?: any; b?: any }[]>} */
  const byDay = new Map();
  const add = (iso, ev) => {
    const key = parseLocalDay(iso);
    if (!key) return;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  };
  for (const b of bookings) add(b.preferredAt, { kind: 'booking', b });
  for (const r of serviceRequests) add(r.createdAt, { kind: 'sr', r });

  for (const [, arr] of byDay) arr.sort((a, b) => eventSortKey(a) - eventSortKey(b));

  const title = new Date(y, m).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
  const today = localYmd(new Date());

  const headRow = WEEKDAYS.map((w) => `<div class="staff-cal__weekday">${escapeHtml(w)}</div>`).join('');

  const cells = monthGridCells(y, m)
    .map((cell) => {
      if (cell.type === 'pad') return '<div class="staff-cal__cell staff-cal__cell--pad" aria-hidden="true"></div>';
      const d = cell.d;
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const evs = byDay.get(key) || [];
      const isToday = key === today;
      const chips = evs
        .slice(0, 5)
        .map((ev) => {
          if (ev.kind === 'booking') {
            const b = ev.b;
            const nm = escapeHtml(b.client?.fullName || b.guestName || 'Визит');
            const t = new Date(b.preferredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            return `<button type="button" class="staff-cal__chip staff-cal__chip--visit" data-cal-kind="booking" data-cal-id="${escapeHtml(b.id)}" title="${escapeHtml(formatDate(b.preferredAt))}">${escapeHtml(t)} ${nm}</button>`;
          }
          const r = ev.r;
          const nm = escapeHtml(r.client?.fullName || r.guestName || 'Заявка');
          const car = escapeHtml(`${r.snapshotMake || ''} ${r.snapshotModel || ''}`.trim() || 'Ремонт');
          return `<button type="button" class="staff-cal__chip staff-cal__chip--sr" data-cal-kind="sr" data-cal-id="${escapeHtml(r.id)}" title="${escapeHtml(formatDate(r.createdAt))}">${nm} · ${car}</button>`;
        })
        .join('');
      const more = evs.length > 5 ? `<div class="staff-cal__more muted">+${evs.length - 5}</div>` : '';
      return `<div class="staff-cal__cell${isToday ? ' staff-cal__cell--today' : ''}" data-cal-day="${key}">
      <div class="staff-cal__daynum">${d}</div>
      <div class="staff-cal__chips">${chips}${more}</div>
    </div>`;
    })
    .join('');

  root.innerHTML = `
    <div class="staff-cal">
      <div class="staff-cal__toolbar">
        <button type="button" class="btn btn--ghost btn-sm" data-cal-nav="prev" aria-label="Предыдущий месяц">‹</button>
        <h3 class="staff-cal__title u-m0">${escapeHtml(title)}</h3>
        <button type="button" class="btn btn--ghost btn-sm" data-cal-nav="next" aria-label="Следующий месяц">›</button>
        <button type="button" class="btn btn--outline btn-sm staff-cal__today" data-cal-nav="today">Сегодня</button>
      </div>
      <p class="staff-cal__legend muted" role="note">
        <span class="staff-cal__legend-i staff-cal__legend-i--visit">Визит</span> — по дате и времени приезда.
        <span class="staff-cal__legend-i staff-cal__legend-i--sr">Ремонт</span> — по дате создания заявки.
      </p>
      <div class="staff-cal__grid">
        ${headRow}
        ${cells}
      </div>
    </div>`;

  root.querySelector('[data-cal-nav="prev"]')?.addEventListener('click', () => {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    root.dataset.calYear = String(y);
    root.dataset.calMonth = String(m);
    handlers.rerender();
  });
  root.querySelector('[data-cal-nav="next"]')?.addEventListener('click', () => {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    root.dataset.calYear = String(y);
    root.dataset.calMonth = String(m);
    handlers.rerender();
  });
  root.querySelector('[data-cal-nav="today"]')?.addEventListener('click', () => {
    const n = new Date();
    root.dataset.calYear = String(n.getFullYear());
    root.dataset.calMonth = String(n.getMonth());
    handlers.rerender();
  });

  root.querySelectorAll('[data-cal-kind]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kind = btn.getAttribute('data-cal-kind');
      const id = btn.getAttribute('data-cal-id');
      if (!id) return;
      if (kind === 'booking') handlers.selectBooking(id);
      else handlers.selectServiceRequest(id);
    });
  });
}
