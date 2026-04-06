import { api, downloadApiFile, getCsrfToken, getUser } from './api.js';
import { clearConsultSessionStorage } from './consultStorage.js';
import { $, escapeHtml, formatDate } from './utils.js';
import { uiAlert, uiPromptContact } from './ui/dialogs.js';

const CONSULT_NEXT = '/consult.html';

/** Если с бэка пришёл объект вместо строки — не показывать "[object Object]". */
function diagLineText(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '[object Object]') return '';
    return t;
  }
  if (typeof raw === 'object') {
    const v = raw.title ?? raw.name ?? raw.text;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function sixComplete(ext) {
  if (!ext) return false;
  const t = (s) => typeof s === 'string' && s.trim().length > 0;
  return (
    t(ext.make) &&
    t(ext.model) &&
    ext.year != null &&
    ext.mileage != null &&
    t(ext.symptoms) &&
    t(ext.problemConditions)
  );
}

function isPlannedServiceResult(data) {
  const fs = data?.flowState;
  return !!(fs && fs.intent === 'service');
}

function formatCarDisplay(ext) {
  const make = String(ext?.make || '').trim();
  let model = String(ext?.model || '').trim();
  const yearNum = Number(ext?.year);
  const year = Number.isFinite(yearNum) ? String(yearNum) : '';
  const mileageNum = Number(ext?.mileage);
  const mileage = Number.isFinite(mileageNum) ? String(Math.round(mileageNum)) : '';

  // Remove noisy numeric tails from model like "Октавия 2020 114".
  model = model.replace(/\s+/g, ' ').trim();
  if (year) {
    model = model.replace(new RegExp(`(?:^|\\s)${year}(?=\\s|$)`, 'g'), ' ').replace(/\s+/g, ' ').trim();
  }
  if (mileage) {
    model = model.replace(new RegExp(`(?:^|\\s)${mileage}(?=\\s|$)`, 'g'), ' ').replace(/\s+/g, ' ').trim();
  }
  model = model.replace(/\s+\d{2,6}$/g, '').trim();

  const base = [make, model].filter(Boolean).join(' ').trim();
  if (!base && year) return `${year} г.`;
  return year ? `${base}, ${year} г.` : base || '—';
}

function fmtMoneyRub(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `${Math.round(x).toLocaleString('ru-RU')} ₽`;
}

function recommendVisitWindow(ext, lastUserText = '') {
  const t = `${ext?.symptoms || ''} ${ext?.problemConditions || ''} ${lastUserText}`.toLowerCase();
  const urgent = [
    'check engine',
    'чек',
    'мигает',
    'горит',
    'ошибка',
    'потеря мощности',
    'не едет',
    'перегрев',
    'температура',
    'дым',
    'запах бензина',
    'течь топлива',
    'тормоз',
    'проваливается педаль',
  ].some((k) => t.includes(k));
  if (urgent) {
    return {
      value: 'сегодня / завтра',
      hint: 'При таких симптомах лучше не откладывать диагностику',
    };
  }
  return { value: 'в течение 1–3 дней', hint: 'Долго откладывать не стоит при регулярных симптомах' };
}

function roundToHundreds(n) {
  return Math.ceil(Number(n) / 100) * 100;
}

function buildCostFrom(costFromMinor) {
  const base = Number(costFromMinor);
  if (!Number.isFinite(base) || base <= 0) return null;
  return Math.max(0, roundToHundreds(base));
}

function determineUrgency(ext, isMaintenance) {
  if (isMaintenance) {
    return {
      level: 'low',
      value: 'Можно продолжать эксплуатацию',
      hint: 'Плановое ТО можно выполнить в удобное время',
    };
  }
  const t = `${ext?.symptoms || ''} ${ext?.problemConditions || ''}`.toLowerCase();
  const high = ['перегрев', 'дым', 'течь топлива', 'проваливается педаль', 'не едет', 'мигает', 'check engine'].some((k) =>
    t.includes(k),
  );
  if (high) {
    return {
      level: 'high',
      value: 'Требуется срочная диагностика',
      hint: 'Лучше не откладывать визит в сервис',
    };
  }
  if (hasSymptoms(ext)) {
    return {
      level: 'medium',
      value: 'Желательно записаться в сервис в течение 2-3 дней',
      hint: 'Эксплуатация возможна, но проблему лучше проверить в ближайшее время',
    };
  }
  return {
    level: 'wait',
    value: 'Ожидаем уточнение',
    hint: 'Ожидаем дополнительные симптомы для уточнения оценки',
  };
}

function hasSymptoms(ext) {
  return typeof ext?.symptoms === 'string' && ext.symptoms.trim().length > 0;
}

function guestApiOpts() {
  const gt = sessionStorage.getItem('consultGuestToken');
  const loggedIn = !!getUser();
  // Be tolerant: if we have a guest token, always send it. If user is not logged in, skip auth.
  const out = {};
  if (gt) out.guestToken = gt;
  if (!loggedIn) out.skipAuth = true;
  return out;
}

/** Сессия в storage привязана к аккаунту или токен устарел — без входа API отвечает 401/403. */
function isConsultSessionAccessDenied(e) {
  if (!e || typeof e.status !== 'number' || !e.data || typeof e.data !== 'object') return false;
  if (e.data.code === 'CSRF') return false;
  if (e.status === 401 && e.data.code === 'GUEST_TOKEN_REQUIRED') return true;
  if (e.status === 403) {
    const c = String(e.data.code || '').toUpperCase();
    if (c === 'CSRF') return false;
    if (c === 'FORBIDDEN') return true;
    if (String(e.data.error || '') === 'Forbidden') return true;
  }
  return false;
}

async function tryClaimPendingGuest() {
  const loggedIn = !!getUser();
  const sid = sessionStorage.getItem('consultSessionId');
  const gt = sessionStorage.getItem('consultGuestToken');
  if (!loggedIn || !sid || !gt) return;
  try {
    await api(`/consultations/${sid}/claim`, { method: 'POST', body: { guestToken: gt } });
    sessionStorage.removeItem('consultGuestToken');
    sessionStorage.setItem('consultMode', 'auth');
  } catch {
    /* остаёмся в гостевом режиме */
  }
}

export async function initConsultPage() {
  const chatEl = $('#chat');
  const form = $('#chatForm');
  const input = $('#messageInput');
  const chatPanel = $('#consultChatPanel');
  const progressWrap = $('#progressWrap');
  const progressBar = $('#progressBar');
  const progressLabel = $('#progressLabel');
  const errBox = $('#consultError');
  const actions = $('#consultActions');
  const btnNew = $('#btnNewSession');
  const btnExportPdf = $('#btnExportConsultPdf');
  const guestBanner = $('#guestConsultBanner');
  const stagePill = $('#stagePill');
  const stageLabel = $('#stageLabel');
  const stageSteps = $('#stageSteps');
  const sideProgressBar = $('#sideProgressBar');
  const sideProgressLabel = $('#sideProgressLabel');
  const summaryTbody = $('#summaryTableBody');
  const sideRecsCard = $('#sideRecommendationsCard');
  const sideRecs = $('#sideRecommendations');
  const sideResultCard = $('#sideResultCard');
  const sideConfidencePill = $('#sideConfidencePill');
  const sideCostValue = $('#sideCostValue');
  const sideCostHint = $('#sideCostHint');
  const sideVisitValue = $('#sideVisitValue');
  const sideVisitHint = $('#sideVisitHint');
  const resultPanel = $('#consultResultPanel');
  const resultConfidenceValue = $('#resultConfidenceValue');
  const resultConfidencePercent = $('#resultConfidencePercent');
  const resultConfidenceBar = $('#resultConfidenceBar');
  const resultConfidenceHint = $('#resultConfidenceHint');
  const resultServiceValue = $('#resultServiceValue');
  const resultServiceHint = $('#resultServiceHint');
  const resultCostRange = $('#resultCostRange');
  const resultCostNote = $('#resultCostNote');
  const resultUrgencyCard = $('#resultUrgencyCard');
  const resultUrgencyValue = $('#resultUrgencyValue');
  const resultUrgencyHint = $('#resultUrgencyHint');
  const resultHypothesesList = $('#resultHypothesesList');
  const resultChecksList = $('#resultChecksList');
  const resultPendingState = $('#resultPendingState');
  const resultRequestPill = $('#resultRequestPill');
  const resultBtnSave = $('#resultBtnSave');
  const resultBtnRequest = $('#resultBtnRequest');
  const resultBtnLogin = $('#resultBtnLogin');
  const resultBtnRegister = $('#resultBtnRegister');
  const guestRequestFormId = 'guestRequestForm';

  let sessionId = sessionStorage.getItem('consultSessionId');

  function syncExportPdfButton() {
    if (!btnExportPdf) return;
    btnExportPdf.hidden = !sessionId;
  }

  function updateGuestBanner(isGuest) {
    if (!guestBanner) return;
    guestBanner.hidden = !isGuest;
  }

  function renderSession(data) {
    errBox.textContent = '';
    errBox.className = 'alert';
    errBox.hidden = true;
    const p = data.progressPercent ?? 0;
    progressBar.style.width = `${p}%`;
    progressLabel.textContent = `Готовность данных: ${p}%`;
    if (progressWrap) progressWrap.hidden = false;
    if (progressLabel) progressLabel.hidden = false;

    if (sideProgressBar) sideProgressBar.style.width = `${p}%`;
    if (sideProgressLabel) sideProgressLabel.textContent = `Прогресс: ${p}%`;

    updateGuestBanner(!!data.isGuest);

    chatEl.innerHTML = '';
    (data.messages || []).forEach((m) => {
      const div = document.createElement('div');
      div.className = `bubble ${m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'}`;
      div.innerHTML = escapeHtml(m.content);
      chatEl.appendChild(div);
    });
    chatEl.scrollTop = chatEl.scrollHeight;

    const ext = data.extracted;
    const done =
      data.status === 'COMPLETED' ||
      Number(data.progressPercent) >= 100 ||
      sixComplete(ext) ||
      !!data.serviceRequest;
    const hasSym = hasSymptoms(ext);
    const plannedService = isPlannedServiceResult(data);
    const hasData = hasSym || done;

    if (resultPanel) resultPanel.hidden = !done;
    if (chatPanel) chatPanel.hidden = !!done;
    const side = document.querySelector('.consult-side');
    if (side) side.hidden = !!done;
    document.body.classList.toggle('is-result-mode', !!done);

    const confNum = data.confidencePercent != null && Number.isFinite(Number(data.confidencePercent))
      ? Math.max(0, Math.min(100, Math.round(Number(data.confidencePercent))))
      : null;
    if (resultConfidenceValue) resultConfidenceValue.textContent = `Уверенность оценки: ${confNum != null ? `${confNum}%` : '—'}`;
    if (resultConfidencePercent) resultConfidencePercent.textContent = confNum != null ? `${confNum}%` : '—';
    if (resultConfidenceBar) resultConfidenceBar.style.width = `${confNum ?? 0}%`;
    if (resultConfidenceHint) {
      resultConfidenceHint.textContent = confNum != null
        ? 'Оценка основана на описании запроса и статистике сервиса.'
        : 'Оценка станет точнее после уточнения деталей.';
    }

    const t = `${ext?.symptoms || ''} ${ext?.problemConditions || ''}`.toLowerCase();
    const checkEngine = ['check engine', 'чек', 'ошибк', 'пропуск', 'троит'].some((k) => t.includes(k));
    const serviceName = plannedService
      ? 'Плановое обслуживание'
      : hasSym
        ? checkEngine
          ? 'Комплексная диагностика двигателя'
          : 'Комплексная диагностика'
        : '—';
    if (resultServiceValue) resultServiceValue.textContent = serviceName;
    if (resultServiceHint)
      resultServiceHint.textContent = plannedService
        ? 'План работ по вашему запросу'
        : hasSym
          ? 'Предварительная оценка и план проверок'
          : 'Станет доступно после описания запроса';

    const costFrom = hasData ? buildCostFrom(data.costFromMinor) : null;
    if (resultCostRange) {
      resultCostRange.textContent = costFrom ? `от ${fmtMoneyRub(costFrom)}` : '—';
    }
    if (resultCostNote) {
      resultCostNote.textContent = costFrom
        ? 'Стоимость уточняется после осмотра автомобиля'
        : 'Ожидаем данные для расчёта стоимости';
    }

    const urgency = determineUrgency(ext, plannedService);
    if (resultUrgencyValue) resultUrgencyValue.textContent = urgency.value;
    if (resultUrgencyHint) resultUrgencyHint.textContent = urgency.hint;
    if (resultUrgencyCard) {
      resultUrgencyCard.classList.remove('urgency--low', 'urgency--medium', 'urgency--high', 'urgency--wait');
      resultUrgencyCard.classList.add(`urgency--${urgency.level}`);
    }

    const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
    const top = recs.slice(0, 5);
    if (resultHypothesesList) {
      if (top.length > 0) {
        resultHypothesesList.innerHTML = top
          .map((r) => {
            const pct = Math.max(0, Math.min(100, Number(r.probabilityPercent) || 0));
            return `<div class="diag-hyp">
                  <div class="diag-hyp__top">
                    <span>${escapeHtml(diagLineText(r.title) || 'Пункт')}</span>
                    <strong>${pct}%</strong>
                  </div>
                  <div class="diag-hyp__bar" aria-hidden="true"><div class="diag-hyp__fill"></div></div>
                </div>`;
          })
          .join('');
        resultHypothesesList.querySelectorAll('.diag-hyp').forEach((wrap, i) => {
          const r = top[i];
          if (!r) return;
          const pct = Math.max(0, Math.min(100, Number(r.probabilityPercent) || 0));
          const fill = wrap.querySelector('.diag-hyp__fill');
          if (fill) fill.style.width = `${pct}%`;
        });
      } else {
        resultHypothesesList.innerHTML =
          '<div class="diag-state muted"><span class="diag-spinner" aria-hidden="true"></span>Ожидаем данные для формирования плана работ</div>';
      }
    }

    if (resultChecksList) {
      const flowChecks = data.flowState?.recommended_checks;
      const checks = Array.isArray(flowChecks)
        ? flowChecks.map((c) => typeof c === 'string' ? c.trim() : '').filter(Boolean).slice(0, 5)
        : [];
      resultChecksList.innerHTML =
        checks.length > 0
          ? checks.map((x) => `<li>${escapeHtml(x)}</li>`).join('')
          : `<li class="muted">План проверок формируется по результатам анализа</li>`;
    }

    if (resultPendingState) {
      resultPendingState.hidden = hasData;
    }

    if (resultRequestPill) {
      resultRequestPill.textContent = data.serviceRequest ? 'Заявка: создана' : 'Заявка: не создана';
    }

    // Result panel actions
    const isGuest = !!data.isGuest;
    if (resultBtnSave) resultBtnSave.hidden = true;
    if (resultBtnRequest) {
      resultBtnRequest.hidden = true;
      resultBtnRequest.textContent = 'Записаться в сервис';
    }
    if (resultBtnLogin) resultBtnLogin.hidden = true;
    if (resultBtnRegister) resultBtnRegister.hidden = true;

    if (done && !data.serviceRequest) {
      if (isGuest) {
        if (resultBtnRequest) resultBtnRequest.hidden = false;
        if (resultBtnRegister) resultBtnRegister.hidden = false;
        if (resultBtnLogin) resultBtnLogin.hidden = false;
      } else {
        if (resultBtnRequest) resultBtnRequest.hidden = false;
        if (resultBtnSave) {
          resultBtnSave.hidden = false;
          resultBtnSave.textContent = 'Отчёт в личном кабинете';
          resultBtnSave.dataset.autoSaved = '1';
        }
      }
    }

    if (resultBtnRequest && !resultBtnRequest.dataset.bound) {
      resultBtnRequest.dataset.bound = '1';
      resultBtnRequest.addEventListener('click', async () => {
        try {
          if (isGuest) {
            const contact = await uiPromptContact({
              fullName: data.guestName || '',
              phone: data.guestPhone || '',
            });
            if (!contact) return;
            await api(`/consultations/${sessionId}/service-request-guest`, {
              method: 'POST',
              body: { ...contact, email: null },
              ...guestApiOpts(),
            });
          } else {
            await api(`/consultations/${sessionId}/service-request`, { method: 'POST' });
          }
          await uiAlert({
            title: 'Заявка создана',
            variant: 'success',
            okText: 'Отлично',
            message: isGuest
              ? 'Чтобы отслеживать статус и переписку в личном кабинете, войдите или зарегистрируйтесь — текущий диалог привяжется к аккаунту.'
              : 'Статус заявки смотрите в личном кабинете.',
          });
          window.location.href = isGuest
            ? `/login.html?next=${encodeURIComponent('/dashboards/client.html#tab=requests')}`
            : '/dashboards/client.html';
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
          errBox.hidden = false;
        }
      });
    }

    if (resultBtnSave && !resultBtnSave.dataset.bound) {
      resultBtnSave.dataset.bound = '1';
      resultBtnSave.addEventListener('click', () => {
        window.location.href = '/dashboards/client.html';
      });
    }

    // Sidebar: result KPI (cost / visit window / confidence)
    const conf = data.confidencePercent;
    if (sideResultCard) sideResultCard.hidden = !done;
    if (sideConfidencePill) {
      sideConfidencePill.textContent =
        conf != null && Number.isFinite(Number(conf)) ? `Уверенность: ${Math.round(Number(conf))}%` : 'Уверенность: —';
    }
    if (sideCostValue) {
      const hasCost = data.costFromMinor != null && Number.isFinite(Number(data.costFromMinor)) && Number(data.costFromMinor) > 0;
      sideCostValue.textContent = hasCost ? `от ${fmtMoneyRub(data.costFromMinor)}` : '—';
    }
    if (sideCostHint) {
      const hasCost = data.costFromMinor != null && Number.isFinite(Number(data.costFromMinor)) && Number(data.costFromMinor) > 0;
      sideCostHint.textContent = hasCost
        ? 'Минимальная оценка по данным сервиса'
        : 'Оценка появится после анализа';
    }
    if (sideVisitValue && sideVisitHint) {
      const visit = plannedService
        ? { value: 'в удобное время', hint: 'Запишитесь на удобный слот' }
        : hasSym
          ? recommendVisitWindow(ext)
          : { value: '—', hint: 'Опишите запрос для оценки срочности' };
      sideVisitValue.textContent = visit.value;
      sideVisitHint.textContent = visit.hint;
    }

    // Sidebar: stage view
    const stage =
      data.status === 'COMPLETED' || p >= 100 || done
        ? 3
        : p >= 60
          ? 2
          : 1;
    if (stagePill) stagePill.textContent = stage === 1 ? 'Сбор данных' : stage === 2 ? 'Уточнение' : 'Результат';
    if (stageLabel)
      stageLabel.textContent =
        stage === 1
          ? 'Уточняем автомобиль и симптомы'
          : stage === 2
            ? 'Уточняем детали и условия проявления'
            : 'Готовим итог и рекомендации';
    if (stageSteps) {
      const steps = Array.from(stageSteps.querySelectorAll('.step'));
      steps.forEach((el, idx) => {
        const n = idx + 1;
        el.classList.toggle('is-active', n === stage);
        el.classList.toggle('is-done', n < stage);
      });
    }

    // Sidebar: summary table
    if (summaryTbody) {
      const rows = [
        ['Марка', ext?.make],
        ['Модель', ext?.model],
        ['Год', ext?.year],
        ['Пробег', ext?.mileage],
        ['Симптомы', ext?.symptoms],
        ['Условия', ext?.problemConditions],
      ];
      summaryTbody.innerHTML = rows
        .map(([k, v]) => {
          const val =
            v == null || (typeof v === 'string' && v.trim().length === 0) ? '<span class="muted">—</span>' : escapeHtml(v);
          return `<tr><td>${escapeHtml(k)}</td><td>${val}</td></tr>`;
        })
        .join('');
    }

    // Sidebar: recommendations (if present)
    if (sideRecsCard && sideRecs) {
      const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
      if (done && recs.length > 0) {
        sideRecsCard.hidden = false;
        const slice = recs.slice(0, 5);
        sideRecs.innerHTML = slice
          .map(
            (r) => `
              <div class="rec-row">
                <div class="rec-title">${escapeHtml(r.title || 'Рекомендация')}</div>
                <div class="rec-meter" aria-hidden="true"><div class="rec-meter__fill"></div></div>
              </div>`,
          )
          .join('');
        sideRecs.querySelectorAll('.rec-row').forEach((row, i) => {
          const r = slice[i];
          if (!r) return;
          const pct = Math.max(0, Math.min(100, Number(r.probabilityPercent) || 0));
          const fill = row.querySelector('.rec-meter__fill');
          if (fill) fill.style.width = `${pct}%`;
        });
      } else {
        sideRecsCard.hidden = true;
        sideRecs.innerHTML = '';
      }
    }

    actions.innerHTML = '';
    if (done && data.isGuest && !data.serviceRequest) {
      const wrap = document.createElement('div');
      wrap.className = 'alert alert--info';
      wrap.innerHTML = `
        <p class="consult-pro__post-message">
          Данные для предварительной оценки собраны. Вы можете <strong>создать заявку как гость</strong> (мы свяжемся по телефону)
          или <strong>войти/зарегистрироваться</strong>, чтобы отслеживать статус и переписку в личном кабинете.
        </p>
        <p class="consult-pro__post-actions">
          <button type="button" class="btn btn--primary" id="${guestRequestFormId}">Создать заявку (гость)</button>
          <a class="btn btn--ghost" href="/login.html?next=${encodeURIComponent(CONSULT_NEXT)}">Войти</a>
          <a class="btn btn--ghost" href="/register.html?next=${encodeURIComponent(CONSULT_NEXT)}">Регистрация</a>
        </p>`;
      actions.appendChild(wrap);

      // Bind guest CTA (reuse existing handler)
      wrap.querySelector(`#${guestRequestFormId}`)?.addEventListener('click', () => resultBtnRequest?.click());
    } else if (done && !data.isGuest && !data.serviceRequest) {
      const b1 = document.createElement('button');
      b1.className = 'btn btn--primary';
      b1.type = 'button';
      b1.textContent = 'Оформить заявку в сервис';
      b1.addEventListener('click', async () => {
        try {
          await api(`/consultations/${sessionId}/service-request`, { method: 'POST' });
          await uiAlert({
            title: 'Заявка создана',
            variant: 'success',
            okText: 'Отлично',
            message: 'Статус заявки смотрите в личном кабинете.',
          });
          window.location.href = '/dashboards/client.html';
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
          errBox.hidden = false;
        }
      });
      const b2 = document.createElement('button');
      b2.className = 'btn btn--ghost';
      b2.type = 'button';
      b2.textContent = 'Сохранить отчёт';
      b2.addEventListener('click', async () => {
        try {
          await api(`/consultations/${sessionId}/report`, {
            method: 'POST',
            body: { label: `Отчёт ${formatDate(new Date().toISOString())}` },
          });
          await uiAlert({
            title: 'Отчёт сохранён',
            variant: 'success',
            okText: 'Хорошо',
            message: 'Отчёт доступен в личном кабинете.',
          });
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
        }
      });
      actions.append(b1, b2);
    } else if (data.serviceRequest) {
      const pEl = document.createElement('p');
      pEl.textContent = 'По этой консультации заявка уже создана.';
      actions.appendChild(pEl);
    }

    if (data.preliminaryNote) {
      const note = document.createElement('p');
      note.className = 'alert alert--info';
      note.textContent = data.preliminaryNote;
      $('#preliminarySlot').innerHTML = '';
      $('#preliminarySlot').appendChild(note);
    }

    syncExportPdfButton();
  }

  async function loadSession() {
    if (!sessionId) return;
    const data = await api(`/consultations/${sessionId}`, guestApiOpts());
    renderSession(data);
  }

  async function startSession() {
    let data;
    const u = getUser();
    if (u?.role === 'CLIENT') {
      sessionStorage.setItem('consultMode', 'auth');
      sessionStorage.removeItem('consultGuestToken');
      try {
        data = await api('/consultations', { method: 'POST', body: {} });
      } catch (e) {
        // В localStorage ещё CLIENT, а cookie сессии нет — продолжаем как гость
        if (e.status !== 401) throw e;
        sessionStorage.setItem('consultMode', 'guest');
        data = await api('/consultations', { method: 'POST', body: {}, skipAuth: true });
        if (data.guestToken) sessionStorage.setItem('consultGuestToken', data.guestToken);
      }
    } else {
      sessionStorage.setItem('consultMode', 'guest');
      data = await api('/consultations', { method: 'POST', body: {}, skipAuth: true });
      if (data.guestToken) sessionStorage.setItem('consultGuestToken', data.guestToken);
    }
    sessionId = data.id;
    sessionStorage.setItem('consultSessionId', sessionId);
    await loadSession();
  }

  btnExportPdf?.addEventListener('click', async () => {
    if (!sessionId) return;
    try {
      await downloadApiFile(`/consultations/${sessionId}/export.pdf`, guestApiOpts());
    } catch (e) {
      await uiAlert({ title: 'Ошибка', message: e.message, variant: 'warn' });
    }
  });

  btnNew?.addEventListener('click', () => {
    clearConsultSessionStorage();
    sessionId = null;
    syncExportPdfButton();
    chatEl.innerHTML = '';
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Готовность данных: 0%';
    if (progressWrap) progressWrap.hidden = false;
    progressLabel.hidden = false;
    actions.innerHTML = '';
    updateGuestBanner(false);
    startSession().catch((e) => {
      errBox.textContent = e.message;
      errBox.className = 'alert alert--error';
      errBox.hidden = false;
    });
  });

  // UX: Enter sends message, Shift+Enter adds new line
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form?.requestSubmit?.();
    }
  });

  const PHASE_LABELS = {
    started: 'ИИ принял сообщение…',
    extracting: 'Извлекаю данные из сообщения…',
    extracted: 'Данные извлечены, проверяю…',
    diagnosing: 'Формирую диагностику…',
  };

  function showThinkingBubble(phase) {
    let bubble = chatEl.querySelector('.bubble--thinking');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'bubble bubble--assistant bubble--thinking';
      chatEl.appendChild(bubble);
    }
    bubble.innerHTML = `<span class="thinking-dot"></span> ${escapeHtml(PHASE_LABELS[phase] || 'ИИ анализирует…')}`;
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function removeThinkingBubble() {
    chatEl.querySelector('.bubble--thinking')?.remove();
  }

  async function sendMessageSSE(text, recoveredOnce = false) {
    const API_BASE = `${window.location.origin}/api`;
    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const gt = sessionStorage.getItem('consultGuestToken');
    if (gt) headers['X-Consultation-Guest-Token'] = gt;

    const userBubble = document.createElement('div');
    userBubble.className = 'bubble bubble--user';
    userBubble.innerHTML = escapeHtml(text);
    chatEl.appendChild(userBubble);
    chatEl.scrollTop = chatEl.scrollHeight;

    showThinkingBubble('started');

    const res = await fetch(`${API_BASE}/consultations/${sessionId}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ content: text }),
    });

    if (!res.ok) {
      removeThinkingBubble();
      const errorData = await res.json().catch(() => ({}));
      const err = Object.assign(new Error(errorData?.error || res.statusText), { status: res.status, data: errorData });
      if (!recoveredOnce && isConsultSessionAccessDenied(err)) {
        userBubble.remove();
        clearConsultSessionStorage();
        sessionId = null;
        await startSession();
        return sendMessageSSE(text, true);
      }
      if (res.status === 503) {
        throw Object.assign(new Error(errorData?.error || 'ИИ временно недоступен'), { status: 503, data: errorData });
      }
      if (res.status === 401 && errorData?.code === 'GUEST_TOKEN_REQUIRED') {
        throw Object.assign(new Error('Guest token lost'), { status: 401, data: errorData });
      }
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let eventType = 'message';
        let eventData = '';
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) eventData = line.slice(6);
        }
        if (!eventData) continue;

        const parsed = JSON.parse(eventData);

        if (eventType === 'thinking' || eventType === 'progress') {
          showThinkingBubble(parsed.phase || 'started');
        } else if (eventType === 'done') {
          finalData = parsed;
        } else if (eventType === 'error') {
          removeThinkingBubble();
          throw Object.assign(new Error(parsed.message || 'Ошибка ИИ'), { status: 503, data: parsed });
        }
      }
    }

    removeThinkingBubble();
    if (finalData) renderSession(finalData);
    else if (sessionId) await loadSession();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      if (!sessionId) await startSession();
      await sendMessageSSE(text);
    } catch (e) {
      removeThinkingBubble();
      if (e.status === 503) {
        errBox.textContent =
          e.data?.error || 'Модуль ИИ временно недоступен. Сообщение сохранено, попробуйте позже.';
        errBox.className = 'alert alert--error';
        errBox.hidden = false;
        if (sessionId) await loadSession().catch(() => {});
      } else if (e.status === 401 && e.data?.code === 'GUEST_TOKEN_REQUIRED') {
        await startSession();
      } else {
        errBox.textContent = e.message;
        errBox.className = 'alert alert--error';
        errBox.hidden = false;
      }
    }
  });

  try {
    await tryClaimPendingGuest();
    sessionId = sessionStorage.getItem('consultSessionId');
    if (sessionId) {
      try {
        await loadSession();
      } catch (e) {
        if (isConsultSessionAccessDenied(e)) {
          clearConsultSessionStorage();
          sessionId = null;
          syncExportPdfButton();
          await startSession();
        } else {
          throw e;
        }
      }
    } else {
      await startSession();
    }
  } catch (e) {
    errBox.textContent = e.message;
    errBox.className = 'alert alert--error';
    errBox.hidden = false;
  }
}
