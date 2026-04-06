import { escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';
import { formatBookingPhoneDigits } from './booking-staff-ui.js';

export const SR_KANBAN_STATUSES = [
  { key: 'NEW', label: 'Новая' },
  { key: 'IN_PROGRESS', label: 'В работе' },
  { key: 'SCHEDULED', label: 'Запланирована' },
  { key: 'COMPLETED', label: 'Завершена' },
  { key: 'CANCELLED', label: 'Отменена' },
];

/** Колонка канбана для записи на визит по её статусу */
const BOOKING_STATUS_TO_COL = {
  PENDING: 'NEW',
  CONFIRMED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
};

/** Куда переносим запись при drop в колонку (только эти три колонки) */
const COL_TO_BOOKING_STATUS = {
  NEW: 'PENDING',
  SCHEDULED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
};

let lastDragEndTs = 0;

function bookingKanbanColumn(b) {
  return BOOKING_STATUS_TO_COL[b.status] || 'NEW';
}

function sortMergedDesc(items) {
  return [...items].sort((a, b) => {
    const ta = a.kind === 'sr' ? new Date(a.r.createdAt).getTime() : new Date(a.b.preferredAt).getTime();
    const tb = b.kind === 'sr' ? new Date(b.r.createdAt).getTime() : new Date(b.b.preferredAt).getTime();
    return tb - ta;
  });
}

/**
 * @param {HTMLElement | null} root
 * @param {{ serviceRequests: any[]; bookings?: any[] }} data
 * @param {{
 *   selectServiceRequest: (id: string) => void;
 *   selectBooking: (id: string) => void;
 *   patchServiceRequest: (id: string, status: string, expectedVersion: number) => Promise<{ version: number }>;
 *   patchBookingStatus: (id: string, status: string) => Promise<unknown>;
 *   reload: () => Promise<void>;
 * }} handlers
 */
export function syncStaffWorkBoard(root, data, handlers) {
  if (!root) return;

  const list = data.serviceRequests || [];
  const bookings = data.bookings || [];

  const byStatus = Object.fromEntries(SR_KANBAN_STATUSES.map((s) => [s.key, /** @type {{ kind: 'sr' | 'booking'; r?: any; b?: any }[]} */ ([])]));
  for (const r of list) {
    const bucket = Object.prototype.hasOwnProperty.call(byStatus, r.status) ? r.status : 'NEW';
    byStatus[bucket].push({ kind: 'sr', r });
  }
  for (const b of bookings) {
    const col = bookingKanbanColumn(b);
    if (byStatus[col]) byStatus[col].push({ kind: 'booking', b });
  }

  const colsHtml = SR_KANBAN_STATUSES.map((s) => {
    const merged = sortMergedDesc(byStatus[s.key]);
    const cards = merged
      .map((item) => {
        if (item.kind === 'sr') {
          const r = item.r;
          const name = escapeHtml(r.client?.fullName || r.guestName || '—');
          const carRaw = `${r.snapshotMake || ''} ${r.snapshotModel || ''}`.trim() || '—';
          const car = escapeHtml(carRaw);
          const id = escapeHtml(r.id);
          return `<article class="sr-kanban__card sr-kanban__card--sr" draggable="true" tabindex="0" data-kind="sr" data-id="${id}" data-version="${r.version}" data-status="${escapeHtml(s.key)}" aria-label="Заявка на ремонт ${id.slice(0, 8)}">
        <div class="sr-kanban__card-kind sr-kanban__card-kind--sr">Ремонт</div>
        <div class="sr-kanban__card-client">${name}</div>
        <div class="sr-kanban__card-car muted">${car}</div>
        <div class="sr-kanban__card-foot"><span class="sr-kanban__card-date">${escapeHtml(formatDate(r.createdAt))}</span><span class="sr-kanban__card-ver" title="Версия записи">вер.&nbsp;${escapeHtml(String(r.version))}</span></div>
      </article>`;
        }
        const b = item.b;
        const name = escapeHtml(b.client?.fullName || b.guestName || '—');
        const phoneRaw = b.client?.phone || b.guestPhone;
        const phone = phoneRaw ? escapeHtml(formatBookingPhoneDigits(phoneRaw)) : '';
        const id = escapeHtml(b.id);
        const when = escapeHtml(formatDate(b.preferredAt));
        const stLabel =
          b.status === 'CONFIRMED' ? 'Подтверждена' : b.status === 'CANCELLED' ? 'Отменена' : 'Ожидает';
        return `<article class="sr-kanban__card sr-kanban__card--booking" draggable="true" tabindex="0" data-kind="booking" data-id="${id}" data-status="${escapeHtml(s.key)}" aria-label="Запись на визит ${id.slice(0, 8)}">
        <div class="sr-kanban__card-kind sr-kanban__card-kind--visit">Визит</div>
        <div class="sr-kanban__card-client">${name}</div>
        <div class="sr-kanban__card-car muted">${when}${phone ? ` · ${phone}` : ''}</div>
        <div class="sr-kanban__card-foot"><span class="sr-kanban__card-date">${escapeHtml(stLabel)}</span></div>
      </article>`;
      })
      .join('');
    const dzLabel = `Колонка «${s.label}». Заявки на ремонт и записи на визит (где разрешено).`;
    return `<section class="sr-kanban__col" aria-label="${escapeHtml(s.label)}">
      <header class="sr-kanban__col-head"><span class="sr-kanban__col-title">${escapeHtml(s.label)}</span><span class="sr-kanban__count">${merged.length}</span></header>
      <div class="sr-kanban__dropzone" data-drop-status="${escapeHtml(s.key)}" aria-label="${escapeHtml(dzLabel)}">${cards}</div>
    </section>`;
  }).join('');

  root.innerHTML = `<p class="sr-kanban__board-hint muted" role="note">Ремонт — статусы заявки. Визит — в «Новая» ждут подтверждения, в «Запланирована» подтверждены, в «Отменена» отменены. Перетащите карточку в другую колонку.</p><div class="sr-kanban__track">${colsHtml}</div>`;

  root.querySelectorAll('.sr-kanban__dropzone').forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('sr-kanban__dropzone--active');
    });
    zone.addEventListener('dragleave', (e) => {
      if (zone.contains(e.relatedTarget)) return;
      zone.classList.remove('sr-kanban__dropzone--active');
    });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('sr-kanban__dropzone--active');
      const newStatus = zone.dataset.dropStatus;
      if (!newStatus) return;

      const srId = e.dataTransfer.getData('text/sr-id');
      const bookingId = e.dataTransfer.getData('text/booking-id');

      if (bookingId) {
        const oldStatus = e.dataTransfer.getData('text/booking-old-status');
        if (newStatus === oldStatus) return;
        const nextBooking = COL_TO_BOOKING_STATUS[newStatus];
        if (!nextBooking) {
          await uiAlert({
            title: 'Запись на визит',
            message:
              'Перетащите в колонку «Новая» (ожидает), «Запланирована» (подтверждена) или «Отменена». Колонки «В работе» и «Завершена» только для заявок на ремонт.',
          });
          return;
        }
        try {
          await handlers.patchBookingStatus(bookingId, nextBooking);
          lastDragEndTs = Date.now();
          await handlers.reload();
        } catch (err) {
          await uiAlert({ title: 'Ошибка', message: err.message || 'Не удалось обновить запись.' });
        }
        return;
      }

      if (srId) {
        const version = Number.parseInt(e.dataTransfer.getData('text/sr-version'), 10);
        const oldStatus = e.dataTransfer.getData('text/sr-old-status');
        if (!Number.isFinite(version) || !newStatus || newStatus === oldStatus) return;
        try {
          await handlers.patchServiceRequest(srId, newStatus, version);
          lastDragEndTs = Date.now();
          await handlers.reload();
        } catch (err) {
          if (err.status === 409) {
            await uiAlert({ title: 'Конфликт', message: 'Данные устарели — список обновлён.' });
            await handlers.reload();
          } else {
            await uiAlert({ title: 'Ошибка', message: err.message || 'Не удалось сменить статус.' });
          }
        }
      }
    });
  });

  root.querySelectorAll('.sr-kanban__card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      const kind = card.dataset.kind || 'sr';
      if (kind === 'booking') {
        e.dataTransfer.setData('text/booking-id', card.dataset.id || '');
        e.dataTransfer.setData('text/booking-old-status', card.dataset.status || '');
      } else {
        e.dataTransfer.setData('text/sr-id', card.dataset.id || '');
        e.dataTransfer.setData('text/sr-version', card.dataset.version || '');
        e.dataTransfer.setData('text/sr-old-status', card.dataset.status || '');
      }
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('sr-kanban__card--dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('sr-kanban__card--dragging');
      lastDragEndTs = Date.now();
    });
    card.addEventListener('click', () => {
      if (Date.now() - lastDragEndTs < 350) return;
      const kind = card.dataset.kind || 'sr';
      if (kind === 'booking') handlers.selectBooking(card.dataset.id || '');
      else handlers.selectServiceRequest(card.dataset.id || '');
    });
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const kind = card.dataset.kind || 'sr';
        if (kind === 'booking') handlers.selectBooking(card.dataset.id || '');
        else handlers.selectServiceRequest(card.dataset.id || '');
      }
    });
  });
}

/**
 * @param {HTMLElement | null} root
 * @param {any[]} list
 * @param {{ selectRow: (id: string) => void; patchStatus: (id: string, status: string, expectedVersion: number) => Promise<{ version: number }>; reload: () => Promise<void> }} handlers
 */
export function syncServiceRequestsKanban(root, list, handlers) {
  syncStaffWorkBoard(
    root,
    { serviceRequests: list, bookings: [] },
    {
      selectServiceRequest: handlers.selectRow,
      selectBooking: () => {},
      patchServiceRequest: handlers.patchStatus,
      patchBookingStatus: async () => {},
      reload: handlers.reload,
    },
  );
}
