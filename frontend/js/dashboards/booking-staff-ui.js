import { api } from '../api.js';
import {
  attachPhoneInputMask,
  formatPhoneInputDisplay,
  formatPhonePretty,
  PHONE_INPUT_PLACEHOLDER,
} from '../phone.js';
import { uiAlert } from '../ui/dialogs.js';
import { escapeHtml, formatDate } from '../utils.js';

export function formatBookingPhoneDigits(d) {
  return formatPhonePretty(d) || '—';
}

export function toDatetimeLocalInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

const AUDIT_LABELS = {
  status: 'Статус',
  preferredAt: 'Дата и время визита',
  notes: 'Комментарий',
  guestName: 'Имя гостя',
  guestPhone: 'Телефон',
  guestEmail: 'Email',
};

const STATUS_RU = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждена',
  CANCELLED: 'Отменена',
};

/** @typedef {{ key: string; label: string; value: string }} StructuredNoteEntry */

/**
 * Выделяет из текста заявки строки «Услуга: …», «Раздел: …» (и en-варианты) для отдельного показа.
 * @param {string | null | undefined} raw
 * @returns {{ entries: StructuredNoteEntry[]; remainder: string }}
 */
export function splitStructuredNotes(raw) {
  const text = String(raw || '');
  const lines = text.split(/\r?\n/);
  /** @type {StructuredNoteEntry[]} */
  const entries = [];
  const rest = [];
  const patterns = [
    { re: /^Услуга\s*:\s*(.+)$/i, label: 'Услуга', key: 'service' },
    { re: /^Раздел\s*:\s*(.+)$/i, label: 'Раздел', key: 'section' },
    { re: /^Service\s*:\s*(.+)$/i, label: 'Услуга', key: 'service' },
    { re: /^Section\s*:\s*(.+)$/i, label: 'Раздел', key: 'section' },
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      rest.push(line);
      continue;
    }
    let matched = false;
    for (const p of patterns) {
      const m = trimmed.match(p.re);
      if (m) {
        const idx = entries.findIndex((e) => e.key === p.key);
        if (idx >= 0) entries.splice(idx, 1);
        entries.push({ key: p.key, label: p.label, value: m[1].trim() });
        matched = true;
        break;
      }
    }
    if (!matched) rest.push(line);
  }
  const remainder = rest.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return { entries, remainder };
}

/**
 * @param {StructuredNoteEntry[]} entries
 * @param {string} remainder
 */
export function mergeStructuredNotes(entries, remainder) {
  const head = entries.map((e) => `${e.label}: ${e.value}`).join('\n');
  const tail = String(remainder || '').trim();
  if (!head) return tail;
  if (!tail) return head;
  return `${head}\n\n${tail}`;
}

function structuredNotesHiddenInput(bid, entries) {
  const json = JSON.stringify(entries);
  return `<input type="hidden" class="bkNotesStructured" data-bid="${bid}" value="${escapeHtml(json)}" />`;
}

function structuredNotesMetaHtml(entries) {
  if (!entries.length) return '';
  const rows = entries
    .map(
      (e) => `<div class="dash__booking-meta-row">
        <dt class="dash__booking-meta-dt">${escapeHtml(e.label)}</dt>
        <dd class="dash__booking-meta-dd">${escapeHtml(e.value)}</dd>
      </div>`,
    )
    .join('');
  return `<div class="dash__booking-meta">
      <span class="dash__booking-meta-title">Из онлайн-заявки</span>
      <dl class="dash__booking-meta-list">${rows}</dl>
    </div>`;
}

function statusPillHtml(status) {
  const tone = status === 'CONFIRMED' ? 'ok' : status === 'CANCELLED' ? 'bad' : 'ghost';
  const cls =
    tone === 'ok' ? 'pill pill--ok' : tone === 'bad' ? 'pill pill--bad' : 'pill pill--ghost';
  const label = STATUS_RU[status] || String(status || '');
  return `<span class="${cls} dash__booking-summary-pill">${escapeHtml(label)}</span>`;
}

function formatAuditValue(key, val) {
  if (val == null || val === '') return '—';
  if (key === 'preferredAt') return formatDate(typeof val === 'string' ? val : String(val));
  if (key === 'status') return STATUS_RU[val] || String(val);
  if (key === 'guestPhone') return formatBookingPhoneDigits(String(val).replace(/\D/g, '')) || String(val);
  return String(val);
}

export function formatAuditChangesHtml(changes) {
  if (!changes || typeof changes !== 'object') return '';
  return Object.entries(changes)
    .map(([k, v]) => {
      const label = AUDIT_LABELS[k] || k;
      if (!v || typeof v !== 'object') return '';
      const from = formatAuditValue(k, v.from);
      const to = formatAuditValue(k, v.to);
      return `<div class="dash__booking-audit-change"><span class="dash__booking-audit-field">${escapeHtml(label)}:</span> <span class="muted">${escapeHtml(from)}</span> → <strong>${escapeHtml(to)}</strong></div>`;
    })
    .join('');
}

/**
 * @param {unknown[]} list
 * @param {'MANAGER' | 'ADMINISTRATOR'} staffRole
 */
export function renderBookingCardsMarkup(list, staffRole) {
  const isAdmin = staffRole === 'ADMINISTRATOR';
  return list
    .map((b) => {
      const sid = `bk-st-${b.id}`;
      const pid = `bk-pref-${b.id}`;
      const nid = `bk-notes-${b.id}`;
      const gid = `bk-gname-${b.id}`;
      const gph = `bk-gphone-${b.id}`;
      const gem = `bk-gemail-${b.id}`;
      const isGuest = !b.clientId;
      const name = escapeHtml(b.client?.fullName || b.guestName || 'Гость');
      const phoneRaw = b.client?.phone || b.guestPhone;
      const phoneDisp = phoneRaw ? escapeHtml(formatBookingPhoneDigits(phoneRaw)) : '';
      const guestBlock = isGuest
        ? `
        <div class="form-field dash__booking-edit-field">
          <label for="${gid}">Имя</label>
          <input type="text" id="${gid}" class="bkGuestName" data-bid="${b.id}" value="${escapeHtml(b.guestName || '')}" maxlength="120" autocomplete="name" />
        </div>
        <div class="form-field dash__booking-edit-field">
          <label for="${gph}">Телефон</label>
          <input type="tel" id="${gph}" class="bkGuestPhone" data-bid="${b.id}" value="${escapeHtml(
            b.guestPhone ? formatPhoneInputDisplay(b.guestPhone) : '',
          )}" maxlength="22" inputmode="tel" placeholder="${escapeHtml(PHONE_INPUT_PLACEHOLDER)}" autocomplete="tel" />
        </div>
        <div class="form-field dash__booking-edit-field">
          <label for="${gem}">Email</label>
          <input type="email" id="${gem}" class="bkGuestEmail" data-bid="${b.id}" value="${escapeHtml(b.guestEmail || '')}" maxlength="120" autocomplete="email" />
        </div>`
        : `<p class="muted dash__booking-client-ro u-mt-sm">Клиент зарегистрирован: имя и телефон в профиле; здесь меняются время визита, статус и комментарий.</p>`;

      const sumId = `bk-sum-${b.id}`;
      const bodyId = `bk-body-${b.id}`;
      const { entries: noteEntries, remainder: noteRemainder } = splitStructuredNotes(b.notes);
      const subText = phoneDisp
        ? `<span class="dash__booking-summary-sub">${name} · ${phoneDisp}</span>`
        : `<span class="dash__booking-summary-sub">${name}</span>`;
      const ariaName = String(b.client?.fullName || b.guestName || 'Гость').trim() || 'Гость';
      const ariaLabel = `Запись: ${ariaName}, ${formatDate(b.preferredAt)}. Нажмите, чтобы изменить`;

      return `<li class="card dash__booking-card" data-booking-id="${b.id}">
        <button type="button" class="dash__booking-summary" id="${sumId}" aria-expanded="false" aria-controls="${bodyId}" aria-label="${escapeHtml(ariaLabel)}">
          <span class="dash__booking-chevron" aria-hidden="true">›</span>
          <span class="dash__booking-summary-center">
            <span class="dash__booking-when">${formatDate(b.preferredAt)}</span>
            ${subText}
          </span>
          ${statusPillHtml(b.status)}
        </button>
        <div class="dash__booking-body" id="${bodyId}" role="region" aria-labelledby="${sumId}" hidden>
          ${structuredNotesHiddenInput(b.id, noteEntries)}
          <div class="dash__booking-sections">
            <section class="dash__booking-section" aria-labelledby="bk-sect-visit-${b.id}">
              <h3 class="dash__booking-section-title" id="bk-sect-visit-${b.id}">Визит</h3>
              <div class="form-field dash__booking-edit-field dash__booking-edit-field--first">
                <label for="${pid}">Дата и время</label>
                <input type="datetime-local" id="${pid}" class="bkPreferredAt dash__booking-input" data-bid="${b.id}" value="${toDatetimeLocalInput(b.preferredAt)}" step="60" />
              </div>
            </section>
            <section class="dash__booking-section" aria-labelledby="bk-sect-contact-${b.id}">
              <h3 class="dash__booking-section-title" id="bk-sect-contact-${b.id}">Клиент</h3>
              ${guestBlock}
            </section>
            <section class="dash__booking-section" aria-labelledby="bk-sect-notes-${b.id}">
              <h3 class="dash__booking-section-title" id="bk-sect-notes-${b.id}">Комментарий мастеру</h3>
              ${structuredNotesMetaHtml(noteEntries)}
              <div class="form-field dash__booking-edit-field">
                <label for="${nid}">${noteEntries.length ? 'Дополнительный текст' : 'Текст комментария'}</label>
                <textarea id="${nid}" class="bkNotes dash__booking-textarea" data-bid="${b.id}" rows="${noteEntries.length ? 4 : 5}" maxlength="2000" placeholder="Пожелания, VIN, симптомы…">${escapeHtml(noteRemainder)}</textarea>
              </div>
            </section>
          </div>
          <footer class="dash__booking-footer">
            <div class="dash__booking-footer-grid">
              <div class="form-field dash__booking-status-field">
                <label for="${sid}">Статус</label>
                <select id="${sid}" class="bookingStatus dash__booking-select dash__booking-footer-select" data-bid="${b.id}" aria-label="Статус записи">
                  <option value="PENDING" ${b.status === 'PENDING' ? 'selected' : ''}>Ожидает подтверждения</option>
                  <option value="CONFIRMED" ${b.status === 'CONFIRMED' ? 'selected' : ''}>Подтверждена</option>
                  <option value="CANCELLED" ${b.status === 'CANCELLED' ? 'selected' : ''}>Отменена</option>
                </select>
              </div>
              <div class="dash__booking-footer-save">
                <button type="button" class="btn btn--primary btn-sm saveBook dash__booking-save" data-bid="${b.id}">Сохранить изменения</button>
              </div>
            </div>
            ${
              isAdmin
                ? `<div class="dash__booking-audit-wrap">
                <button type="button" class="btn btn--ghost btn-sm bkAuditToggle" data-bid="${b.id}" aria-expanded="false">Журнал изменений</button>
                <div class="dash__booking-audit-panel" data-audit-panel="${b.id}" hidden></div>
              </div>`
                : ''
            }
          </footer>
        </div>
      </li>`;
    })
    .join('');
}

/**
 * @param {HTMLElement} listEl
 * @param {{ staffRole: 'MANAGER' | 'ADMINISTRATOR'; reload: () => Promise<void> }} opts
 */
export function attachBookingListHandlers(listEl, { staffRole, reload }) {
  const isAdmin = staffRole === 'ADMINISTRATOR';

  listEl.querySelectorAll('input.bkGuestPhone').forEach((el) => attachPhoneInputMask(el));

  listEl.querySelectorAll('.dash__booking-summary').forEach((sum) => {
    sum.addEventListener('click', () => {
      const card = sum.closest('[data-booking-id]');
      const body = card?.querySelector('.dash__booking-body');
      if (!card || !body) return;
      const open = sum.getAttribute('aria-expanded') === 'true';
      const next = !open;
      sum.setAttribute('aria-expanded', String(next));
      body.hidden = !next;
      card.classList.toggle('is-open', next);
    });
  });

  listEl.querySelectorAll('.saveBook').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bid = btn.dataset.bid;
      const card = listEl.querySelector(`[data-booking-id="${bid}"]`);
      if (!card) return;
      const sel = card.querySelector(`select.bookingStatus[data-bid="${bid}"]`);
      if (!sel) return;
      const pref = card.querySelector(`input.bkPreferredAt[data-bid="${bid}"]`);
      const notesEl = card.querySelector(`textarea.bkNotes[data-bid="${bid}"]`);
      /** @type {Record<string, unknown>} */
      const body = {
        status: sel.value,
      };
      if (pref?.value) {
        body.preferredAt = new Date(pref.value).toISOString();
      }
      if (notesEl) {
        const structuredInp = card.querySelector(`input.bkNotesStructured[data-bid="${bid}"]`);
        let entries = [];
        if (structuredInp?.value) {
          try {
            const parsed = JSON.parse(structuredInp.value);
            if (Array.isArray(parsed)) entries = parsed;
          } catch {
            entries = [];
          }
        }
        const t = notesEl.value.slice(0, 2000);
        const merged = mergeStructuredNotes(entries, t);
        const capped = merged.slice(0, 2000);
        body.notes = capped.trim() === '' ? null : capped;
      }

      const guestName = card.querySelector(`input.bkGuestName[data-bid="${bid}"]`);
      const guestPhone = card.querySelector(`input.bkGuestPhone[data-bid="${bid}"]`);
      const guestEmail = card.querySelector(`input.bkGuestEmail[data-bid="${bid}"]`);
      if (guestName && guestPhone) {
        body.guestName = guestName.value.trim();
        body.guestPhone = guestPhone.value;
        const em = guestEmail?.value?.trim() || '';
        body.guestEmail = em === '' ? null : em;
      }

      btn.disabled = true;
      try {
        await api(`/bookings/${bid}`, { method: 'PATCH', body });
        await reload();
      } catch (e) {
        await uiAlert({ title: 'Ошибка', message: e.message || 'Не удалось сохранить.' });
      } finally {
        btn.disabled = false;
      }
    });
  });

  if (isAdmin) {
    listEl.querySelectorAll('.bkAuditToggle').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bid = btn.dataset.bid;
        const panel = listEl.querySelector(`[data-audit-panel="${bid}"]`);
        if (!panel) return;
        const open = btn.getAttribute('aria-expanded') === 'true';
        if (open) {
          panel.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
          return;
        }
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        if (panel.dataset.loaded === '1') return;
        panel.innerHTML = `<div class="muted">Загрузка…</div>`;
        try {
          const rows = await api(`/bookings/${bid}/audit`);
          panel.dataset.loaded = '1';
          if (!Array.isArray(rows) || !rows.length) {
            panel.innerHTML = `<div class="muted">Записей пока нет.</div>`;
            return;
          }
          panel.innerHTML = rows
            .map(
              (row) => `<div class="dash__booking-audit-entry">
            <div class="dash__booking-audit-meta">${escapeHtml(formatDate(row.createdAt))} · ${escapeHtml(row.actor?.fullName || '—')}</div>
            ${formatAuditChangesHtml(row.changes)}
          </div>`,
            )
            .join('');
        } catch (e) {
          panel.innerHTML = `<div class="empty">${escapeHtml(e.message || 'Ошибка')}</div>`;
        }
      });
    });
  }
}
