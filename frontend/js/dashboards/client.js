import { api, downloadApiFile, setUser } from '../api.js';
import { isPreferredAtInMoscowBookingWindow } from '../booking-hours.js';
import { attachPhoneInputMask, formatPhoneInputDisplay, isValidPhoneInput } from '../phone.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml, formatDate } from '../utils.js';
import { uiAlert } from '../ui/dialogs.js';
import { consumeBookingPrefill } from '../services-page.js';

export async function initClientDashboard() {
  const user = requireAuth(['CLIENT']);
  if (!user) return;

  const root = $('#clientRoot');
  let selectedRequestId = null;
  let selectedSessionId = null;
  let selectedReportId = null;
  let reportsCache = [];
  let activeTab = 'profile';

  // Ensure initial placeholders are consistent even before any selection.
  try {
    const tf = $('#threadForm');
    if (tf) tf.style.display = 'none';
  } catch {
    /* ignore */
  }

  async function tryClaimPendingGuest() {
    const sid = sessionStorage.getItem('consultSessionId');
    const gt = sessionStorage.getItem('consultGuestToken');
    if (!sid || !gt) return;
    try {
      await api(`/consultations/${sid}/claim`, { method: 'POST', body: { guestToken: gt } });
      sessionStorage.removeItem('consultGuestToken');
      sessionStorage.removeItem('consultSessionId');
      sessionStorage.setItem('consultMode', 'auth');
      await uiAlert({
        title: 'Готово',
        message:
          'Мы привязали вашу гостевую консультацию к аккаунту. Теперь статус заявки и переписка доступны в личном кабинете.',
      });
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

  function applyBookingPrefillFromRoute() {
    const notes = $('#notes');
    if (!notes) return;
    const pre = consumeBookingPrefill();
    const sp = new URLSearchParams(window.location.search);
    const fromQuery = sp.get('service');
    let line = '';
    if (pre?.serviceTitle) {
      line = pre.categoryLabel
        ? `Запись на услугу: ${pre.serviceTitle} (${pre.categoryLabel})`
        : `Запись на услугу: ${pre.serviceTitle}`;
    } else if (fromQuery) {
      line = `Запись на услугу: ${fromQuery}`;
    }
    if (!line) return;
    notes.value = notes.value && notes.value.trim() ? `${notes.value.trim()}\n${line}` : line;
    setActiveTab('bookings');
    window.setTimeout(() => notes.focus(), 150);
  }

  function markField(el, valid) {
    const field = el?.closest('.form-field');
    if (!field) return;
    field.classList.toggle('is-invalid', !valid);
    field.classList.toggle('is-valid', valid);
  }

  function setMinDateTimeLocal(input) {
    if (!input || input.type !== 'datetime-local') return;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    input.min = now.toISOString().slice(0, 16);
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

  function statusRu(status) {
    const map = {
      NEW: 'Новая',
      IN_PROGRESS: 'В работе',
      SCHEDULED: 'Запланирована',
      COMPLETED: 'Завершена',
      CANCELLED: 'Отменена',
      AI_ERROR: 'Ошибка ИИ',
      PENDING: 'Ожидает',
      CONFIRMED: 'Подтверждена',
    };
    return map[String(status || '').toUpperCase()] || status || '—';
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
      box.innerHTML = `<div class="empty">Выберите консультацию слева, чтобы увидеть детали и переписку.</div>`;
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
      <div class="dash__section-head">
        <strong>${formatDate(s.createdAt)}</strong>
        ${badge(`${statusRu(s.status)}`, s.status === 'COMPLETED' ? 'ok' : s.status === 'AI_ERROR' ? 'bad' : 'ghost')}
      </div>
      <p class="muted dash__stat-line">Прогресс: ${s.progressPercent ?? 0}% · Уверенность: ${
        s.confidencePercent != null ? `${s.confidencePercent}%` : '—'
      } · Ориентир по стоимости: ${s.costFromMinor != null ? `от ${fmtMoney(s.costFromMinor)}` : '—'}</p>
      <div class="table-wrap dash__table-margin">
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
          ? `<div class="dash__recs">
              <strong>Рекомендации</strong>
              <ul class="dash__recs-list">${recs}</ul>
            </div>`
          : ''
      }
      ${s.preliminaryNote ? `<p class="alert alert--info">${escapeHtml(s.preliminaryNote)}</p>` : ''}
      <div class="chat dash__chat--short">${chat || '<div class="empty">Сообщений пока нет.</div>'}</div>
      <p class="dash__row-actions">
        <button type="button" class="btn btn--ghost" id="btnExportConsultPdfClient">Скачать PDF</button>
        <a class="btn btn--ghost" href="/consult.html">Продолжить в чате</a>
        ${!s.serviceRequest ? `<button type="button" class="btn btn--primary" id="btnCreateSr">Создать заявку</button>` : ''}
      </p>
    `;

    box.querySelector('#btnExportConsultPdfClient')?.addEventListener('click', async () => {
      try {
        await downloadApiFile(`/consultations/${s.id}/export.pdf`);
      } catch (e) {
        await uiAlert({ title: 'Ошибка', message: e.message });
      }
    });

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
      box.innerHTML = `<div class="empty">Выберите отчёт слева, чтобы открыть детали.</div>`;
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
      <p class="muted dash__stat-line">${formatDate(r.createdAt)} · Статус: ${escapeHtml(
        statusRu(snap.status) || '—',
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
          ? `<div class="dash__recs"><strong>Рекомендации</strong><ul class="dash__recs-list">${recs}</ul></div>`
          : ''
      }
    `;
  }

  async function refresh() {
    const [sessions, requestsRes, reports, bookings] = await Promise.all([
      api('/consultations'),
      api('/service-requests?pageSize=100'),
      api('/users/me/consultation-reports'),
      api('/bookings'),
    ]);
    const requests = Array.isArray(requestsRes) ? requestsRes : requestsRes.items || [];

    $('#sessList').innerHTML =
      sessions.length === 0
        ? `<li class="muted">Пока нет консультаций. <a href="/consult.html">Начать консультацию</a></li>`
        : sessions
            .map((s) => {
              const tone = s.status === 'COMPLETED' ? 'ok' : s.status === 'AI_ERROR' ? 'bad' : 'ghost';
              return `<li class="card dash__consult-item" data-sid="${s.id}">
                <div class="dash__section-head">
                  <strong>${formatDate(s.createdAt)}</strong>
                  ${badge(`${statusRu(s.status)} · ${s.progressPercent ?? 0}%`, tone)}
                </div>
                ${s.extracted?.make || s.extracted?.model ? `<div class="muted">${escapeHtml(s.extracted?.make || '')} ${escapeHtml(s.extracted?.model || '')}</div>` : ''}
                ${s.serviceRequest ? `<div class="muted">Заявка: ${escapeHtml(statusRu(s.serviceRequest.status))}</div>` : ''}
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

    $('#reqList').innerHTML =
      requests.length === 0
        ? `<tr><td colspan="3"><div class="empty">Пока нет заявок. Завершите консультацию и создайте заявку — менеджер свяжется с вами.</div></td></tr>`
        : requests
            .map((r) => {
              const tone = r.status === 'COMPLETED' ? 'ok' : r.status === 'CANCELLED' ? 'bad' : 'ghost';
              return `<tr data-id="${r.id}" class="u-pointer">
        <td>${formatDate(r.createdAt)}</td>
        <td>${escapeHtml(r.snapshotMake || '')} ${escapeHtml(r.snapshotModel || '')}</td>
        <td>${badge(statusRu(r.status), tone)}</td>
      </tr>`;
            })
            .join('');

    $('#reqList')
      .querySelectorAll('tr[data-id]')
      .forEach((tr) => {
        if (tr.dataset.id === selectedRequestId) tr.classList.add('is-selected');
        tr.addEventListener('click', () => openThread(tr.dataset.id));
      });

    const srSel = $('#bookingServiceRequestId');
    if (srSel) {
      srSel.innerHTML =
        `<option value="">— не привязывать к заявке —</option>` +
        requests.map((r) => `<option value="${r.id}">${r.id.slice(0, 8)}… ${statusRu(r.status)}</option>`).join('');
    }

    reportsCache = reports || [];
    $('#repList').innerHTML =
      reportsCache.length === 0
        ? `<li class="muted">Пока нет сохранённых отчётов. Завершите консультацию и нажмите «Сохранить отчёт».</li>`
        : reportsCache
            .map(
              (r) => `<li class="card dash__report-item" data-rid="${r.id}">
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
      .map((b) => {
        const tone = b.status === 'CONFIRMED' ? 'ok' : b.status === 'CANCELLED' ? 'bad' : 'ghost';
        return `<li class="card dash__booking-simple">
        ${formatDate(b.preferredAt)} — ${badge(statusRu(b.status), tone)}${b.notes ? `<br><small>${escapeHtml(b.notes)}</small>` : ''}
      </li>`;
      })
      .join('');
    if (!bookings.length) {
      $('#bookList').innerHTML = `<li class="empty">Пока нет записей. Оставьте удобное время выше — менеджер подтвердит визит.</li>`;
    }
  }

  async function openThread(requestId) {
    selectedRequestId = requestId;
    const msgs = await api(`/service-requests/${requestId}/messages`);
    $('#threadBody').innerHTML = msgs.length
      ? msgs
          .map(
            (m) => `<div class="bubble bubble--assistant dash__thread-msg">
        <small>${escapeHtml(m.author?.fullName || '')} (${escapeHtml(m.author?.role || '')}) — ${formatDate(m.createdAt)}</small><br>
        ${escapeHtml(m.body)}
      </div>`,
          )
          .join('')
      : `<div class="empty">Сообщений пока нет. Напишите менеджеру — он увидит сообщение в своём кабинете.</div>`;

    const detail = await api(`/service-requests/${requestId}`);
    const closed = detail.status === 'COMPLETED' || detail.status === 'CANCELLED';
    $('#threadForm').style.display = closed ? 'none' : 'block';
    $('#threadTitle').innerHTML = `Переписка по заявке <strong>${escapeHtml(detail.id.slice(0, 8))}…</strong> ${badge(
      statusRu(detail.status),
      detail.status === 'COMPLETED' ? 'ok' : detail.status === 'CANCELLED' ? 'bad' : 'ghost',
    )}`;

    const d = $('#reqDetail');
    if (d) {
      d.innerHTML = `
        <div class="dash__section-head">
          <strong>Заявка ${escapeHtml(detail.id.slice(0, 8))}…</strong>
          ${badge(statusRu(detail.status), detail.status === 'COMPLETED' ? 'ok' : detail.status === 'CANCELLED' ? 'warn' : 'ghost')}
        </div>
        <p class="muted dash__stat-line">${formatDate(detail.createdAt)}</p>
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
            ? `<p class="muted dash__sr-note">Есть транскрипт ИИ и заполненные данные из консультации.</p>`
            : ''
        }
        <p class="dash__row-actions u-mt-sm">
          <button type="button" class="btn btn--ghost btn-sm" id="btnExportRequestPdfClient">Скачать PDF</button>
        </p>
      `;
      d.querySelector('#btnExportRequestPdfClient')?.addEventListener('click', async () => {
        try {
          await downloadApiFile(`/service-requests/${requestId}/export.pdf`);
        } catch (e) {
          await uiAlert({ title: 'Ошибка', message: e.message });
        }
      });
    }

    document.querySelectorAll('#reqList tr[data-id]').forEach((tr) => {
      tr.classList.toggle('is-selected', tr.dataset.id === selectedRequestId);
    });
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
    const form = e.target;
    const preferredEl = $('#preferredAt');
    const fd = new FormData(form);
    const dt = fd.get('preferredAt');
    form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
    if (!dt) {
      markField(preferredEl, false);
      await uiAlert({
        title: 'Дата и время',
        message: 'Укажите желаемое время визита.',
      });
      return;
    }
    const at = new Date(dt);
    if (Number.isNaN(at.getTime())) {
      markField(preferredEl, false);
      return;
    }
    if (!isPreferredAtInMoscowBookingWindow(at)) {
      markField(preferredEl, false);
      await uiAlert({
        title: 'Нерабочее время',
        message: 'Запись доступна с 9:00 до 21:00 по московскому времени. Выберите другое время.',
      });
      return;
    }
    markField(preferredEl, true);
    const iso = at.toISOString();
    await api('/bookings', {
      method: 'POST',
      body: {
        preferredAt: iso,
        notes: fd.get('notes') || null,
        serviceRequestId: fd.get('serviceRequestId') || null,
      },
    });
    form.reset();
    setMinDateTimeLocal(preferredEl);
    await refresh();
    await uiAlert({
      title: 'Запись принята',
      message:
        'Ваша заявка на визит зарегистрирована. Администратор свяжется с вами для подтверждения; актуальный статус отображается в разделе «Запись в сервис».',
      footnote: 'Если телефон вдруг молчит — загляните в кабинет: иногда спокойнее, чем ждать гудков.',
      variant: 'success',
      okText: 'Понятно',
    });
  });

  async function loadProfile() {
    const me = await api('/users/me');
    $('#pfFullName').value = me.fullName || '';
    $('#pfPhone').value = formatPhoneInputDisplay(me.phone || '') || '';
    $('#pfEmailProfile').value = me.emailProfile || '';
  }

  attachPhoneInputMask($('#pfPhone'));

  $('#profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#profileMsg');
    const fullNameEl = $('#pfFullName');
    const phoneEl = $('#pfPhone');
    const emailEl = $('#pfEmailProfile');
    $('#profileForm')
      ?.querySelectorAll('.form-field')
      .forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
    const fullName = fullNameEl.value.trim();
    const phone = phoneEl.value.trim();
    if (!fullName) {
      markField(fullNameEl, false);
      if (msg) msg.textContent = 'Укажите имя.';
      return;
    }
    markField(fullNameEl, true);
    if (!phone || !isValidPhoneInput(phone)) {
      markField(phoneEl, false);
      if (msg) msg.textContent = 'Укажите корректный телефон.';
      return;
    }
    markField(phoneEl, true);
    try {
      const emailProfile = emailEl.value.trim();
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
    setMinDateTimeLocal($('#preferredAt'));
    applyBookingPrefillFromRoute();
    await tryClaimPendingGuest();
    await refresh();
    renderConsultDetail(null);
    renderReportDetail(null);
    await loadProfile();
  } catch (e) {
    if (e?.status === 401 || /unauthorized/i.test(String(e?.message || ''))) {
      root.innerHTML = `
        <section class="card dash__inline-login">
          <h2 class="dash__title">Сессия завершилась</h2>
          <p class="muted dash__inline-login-hint">
            Войдите снова, чтобы открыть личный кабинет. Можно сделать это прямо здесь.
          </p>
          <div id="inlineLoginError" class="alert" role="alert" hidden></div>
          <form id="inlineLoginForm" class="stack dash__inline-login-form">
            <div class="form-field dash__form-field">
              <label for="inlineEmail">Email</label>
              <input id="inlineEmail" name="email" type="email" autocomplete="username" required />
            </div>
            <div class="form-field dash__form-field">
              <label for="inlinePassword">Пароль</label>
              <input id="inlinePassword" name="password" type="password" autocomplete="current-password" required />
            </div>
            <div class="u-flex-inline">
              <button type="submit" class="btn btn--primary">Войти</button>
              <a class="btn btn--ghost" href="/register.html?next=${encodeURIComponent('/dashboards/client.html')}">Регистрация</a>
              <a class="btn btn--ghost" href="/index.html">На главную</a>
            </div>
          </form>
          <div class="muted dash__hint-bottom">
            Если забыли пароль, попробуйте другой аккаунт или обратитесь к администратору.
          </div>
        </section>
      `;
      const form = document.getElementById('inlineLoginForm');
      const err = document.getElementById('inlineLoginError');
      form?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        if (err) {
          err.textContent = '';
          err.className = 'alert';
          err.hidden = true;
        }
        try {
          const data = await api('/auth/login', {
            method: 'POST',
            body: { email: fd.get('email'), password: fd.get('password') },
            skipAuth: true,
            skipCsrf: true,
          });
          setUser(data.user);
          window.location.href = '/dashboards/client.html';
        } catch (loginErr) {
          if (err) {
            err.textContent = loginErr.message || 'Не удалось войти.';
            err.className = 'alert alert--error';
            err.hidden = false;
          }
        }
      });
      return;
    }
    root.innerHTML = `<p class="alert alert--error">${escapeHtml(e.message || 'Ошибка загрузки кабинета')}</p>`;
  }
}
