import { api, getToken, getUser } from './api.js';
import { $, escapeHtml, formatDate } from './utils.js';
import { uiAlert, uiPromptContact } from './ui/dialogs.js';

const CONSULT_NEXT = '/consult.html';

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

function isMaintenanceRecommendations(recs) {
  if (!Array.isArray(recs) || recs.length === 0) return false;
  return recs.some((r) => /планов.*то|техобслуж/i.test(String(r?.title || '')));
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

function hasSymptoms(ext) {
  return typeof ext?.symptoms === 'string' && ext.symptoms.trim().length > 0;
}

function guestApiOpts() {
  const gt = sessionStorage.getItem('consultGuestToken');
  const token = getToken();
  // Be tolerant: if we have a guest token, always send it. If user is not logged in, skip auth.
  const out = {};
  if (gt) out.guestToken = gt;
  if (!token) out.skipAuth = true;
  return out;
}

async function tryClaimPendingGuest() {
  const token = getToken();
  const sid = sessionStorage.getItem('consultSessionId');
  const gt = sessionStorage.getItem('consultGuestToken');
  if (!token || !sid || !gt) return;
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
  const guestBanner = $('#guestConsultBanner');
  const stagePill = $('#stagePill');
  const stageLabel = $('#stageLabel');
  const stageSteps = $('#stageSteps');
  const sideProgressBar = $('#sideProgressBar');
  const sideProgressLabel = $('#sideProgressLabel');
  const summaryTbody = $('#summaryTableBody');
  const sideRecsCard = $('#sideRecommendationsCard');
  const sideRecs = $('#sideRecommendations');
  const sideConfidencePill = $('#sideConfidencePill');
  const sideCostValue = $('#sideCostValue');
  const sideCostHint = $('#sideCostHint');
  const sideVisitValue = $('#sideVisitValue');
  const sideVisitHint = $('#sideVisitHint');
  const resultPanel = $('#consultResultPanel');
  const resultConfidencePill = $('#resultConfidencePill');
  const resultServiceValue = $('#resultServiceValue');
  const resultServiceHint = $('#resultServiceHint');
  const resultCostValue = $('#resultCostValue');
  const resultCostHint = $('#resultCostHint');
  const resultVisitValue = $('#resultVisitValue');
  const resultVisitHint = $('#resultVisitHint');
  const resultHypothesesBody = $('#resultHypothesesBody');
  const resultSummaryBody = $('#resultSummaryBody');
  const resultAdviceList = $('#resultAdviceList');
  const resultRequestPill = $('#resultRequestPill');
  const resultBtnSave = $('#resultBtnSave');
  const resultBtnRequest = $('#resultBtnRequest');
  const resultBtnLogin = $('#resultBtnLogin');
  const resultBtnRegister = $('#resultBtnRegister');
  const guestRequestFormId = 'guestRequestForm';

  let sessionId = sessionStorage.getItem('consultSessionId');

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
    const isMaintenance = isMaintenanceRecommendations(data.recommendations);

    // Result big panel (like the reference UI) appears when data is ready
    if (resultPanel) resultPanel.hidden = !done;
    // After completion hide chat input and side widgets to avoid duplicate info
    if (chatPanel) chatPanel.hidden = !!done;
    // Keep consult grid but collapse sidebar to reduce noise
    const side = document.querySelector('.consult-side');
    if (side) side.hidden = !!done;
    document.body.classList.toggle('is-result-mode', !!done);

    const user = getUser();
    const visit = isMaintenance
      ? { value: 'в течение 3-7 дней', hint: 'Плановое ТО можно выполнить в удобное для вас время' }
      : hasSym
        ? recommendVisitWindow(ext)
        : { value: '—', hint: 'Опишите симптомы, чтобы оценить срочность' };
    const confLabel =
      data.confidencePercent != null && Number.isFinite(Number(data.confidencePercent))
        ? `Уверенность ИИ: ${Math.round(Number(data.confidencePercent))}`
        : 'Уверенность ИИ: —';
    if (resultConfidencePill) resultConfidencePill.textContent = confLabel;

    // Service type heuristic
    const t = `${ext?.symptoms || ''} ${ext?.problemConditions || ''}`.toLowerCase();
    const checkEngine = ['check engine', 'чек', 'ошибк', 'пропуск', 'троит'].some((k) => t.includes(k));
    const serviceName = isMaintenance
      ? 'Плановое ТО'
      : hasSym
      ? checkEngine
        ? 'Комплексная диагностика двигателя'
        : 'Комплексная диагностика'
      : '—';
    if (resultServiceValue) resultServiceValue.textContent = serviceName;
    if (resultServiceHint)
      resultServiceHint.textContent = isMaintenance
        ? 'Регламентные работы по пробегу и состоянию расходников'
        : hasSym
        ? checkEngine
          ? 'Компьютерная диагностика + проверка системы зажигания/топлива'
          : 'Первичная диагностика + проверка узлов по симптомам'
        : 'Станет доступно после описания проблемы';

    const costOk = (hasSym || isMaintenance) && data.costFromMinor != null && Number.isFinite(Number(data.costFromMinor));
    if (resultCostValue) resultCostValue.textContent = costOk ? `от ${fmtMoneyRub(data.costFromMinor)}` : '—';
    if (resultCostHint)
      resultCostHint.textContent = costOk
        ? isMaintenance
          ? 'Минимальная стоимость базового регламентного ТО'
          : 'Диапазон зависит от марки/объёма работ и результатов диагностики'
        : 'Станет доступно после уточнения данных';

    if (resultVisitValue) resultVisitValue.textContent = visit.value;
    if (resultVisitHint) resultVisitHint.textContent = visit.hint;

    // Hypotheses table from recommendations
    if (resultHypothesesBody) {
      const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
      const top = isMaintenance ? recs.slice(0, 5) : hasSym ? recs.slice(0, 5) : [];
      resultHypothesesBody.innerHTML =
        top.length === 0
          ? `<tr><td class="muted">—</td><td class="muted">—</td></tr>`
          : top
              .map((r) => {
                const pct = Math.max(0, Math.min(100, Number(r.probabilityPercent) || 0));
                return `<tr>
                  <td>${escapeHtml(r.title || 'Гипотеза')}</td>
                  <td>
                    <div class="prob" aria-hidden="true">
                      <div class="prob__bar"><div style="width:${pct}%"></div></div>
                      <div class="prob__val">${pct}%</div>
                    </div>
                  </td>
                </tr>`;
              })
              .join('');
    }

    // Summary table (client/car/problem)
    if (resultSummaryBody) {
      const car = formatCarDisplay(ext);
      const prob = ext?.symptoms ? String(ext.symptoms) : '';
      const condition = ext?.problemConditions ? String(ext.problemConditions) : '';
      const rows = [
        ['Клиент', user?.email || 'гость'],
        ['Автомобиль', car || '—'],
        ['Симптомы', isMaintenance ? 'Не требуется для планового ТО' : prob || '—'],
        ['Условия', isMaintenance ? 'Не требуется для планового ТО' : condition || '—'],
      ];
      resultSummaryBody.innerHTML = rows
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
        .join('');
    }

    if (resultAdviceList) {
      const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
      const bullets =
        (hasSym || isMaintenance) && recs.length > 0
          ? recs.slice(0, 4).map((r) => r.title).filter(Boolean)
          : [
              'Опишите симптомы и условия проявления, чтобы сузить круг причин',
              'Если горят лампы ошибок или есть потеря мощности — лучше не откладывать визит',
              'Если есть посторонние звуки/запахи/дым — прекратите движение и вызовите помощь',
            ];
      resultAdviceList.innerHTML = bullets.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    }

    if (resultRequestPill) {
      resultRequestPill.textContent = data.serviceRequest ? 'Заявка: создана' : 'Заявка: не создана';
    }

    // Result panel actions
    const isGuest = !!data.isGuest;
    if (resultBtnSave) resultBtnSave.hidden = true;
    if (resultBtnRequest) {
      resultBtnRequest.hidden = true;
      resultBtnRequest.textContent = 'Оставить заявку';
    }
    if (resultBtnLogin) resultBtnLogin.hidden = true;
    if (resultBtnRegister) resultBtnRegister.hidden = true;

    if (done && !data.serviceRequest) {
      if (isGuest) {
        // Guest can create a request without registration, but must provide name + phone
        if (resultBtnRequest) resultBtnRequest.hidden = false;
        if (resultBtnRegister) resultBtnRegister.hidden = false;
        if (resultBtnLogin) resultBtnLogin.hidden = false;
      } else {
        if (resultBtnSave) resultBtnSave.hidden = false;
        if (resultBtnRequest) resultBtnRequest.hidden = false;
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
            message: isGuest
              ? 'Заявка создана. Чтобы отслеживать статус и переписку в личном кабинете, войдите или зарегистрируйтесь — текущий диалог привяжется к аккаунту.'
              : 'Заявка создана. Смотрите статус в личном кабинете.',
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
      resultBtnSave.addEventListener('click', async () => {
        try {
          await api(`/consultations/${sessionId}/report`, {
            method: 'POST',
            body: { label: `Отчёт ${formatDate(new Date().toISOString())}` },
          });
          await uiAlert({ title: 'Отчёт сохранён', message: 'Отчёт сохранён и доступен в личном кабинете.' });
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
          errBox.hidden = false;
        }
      });
    }

    // Sidebar: result KPI (cost / visit window / confidence)
    const conf = data.confidencePercent;
    if (sideConfidencePill) {
      sideConfidencePill.textContent =
        conf != null && Number.isFinite(Number(conf)) ? `Уверенность: ${Math.round(Number(conf))}%` : 'Уверенность: —';
    }
    if (sideCostValue) {
      sideCostValue.textContent =
        (hasSym || isMaintenance) && data.costFromMinor != null && Number.isFinite(Number(data.costFromMinor))
          ? `от ${fmtMoneyRub(data.costFromMinor)}`
          : '—';
    }
    if (sideCostHint) {
      sideCostHint.textContent =
        (hasSym || isMaintenance) && data.costFromMinor != null && Number.isFinite(Number(data.costFromMinor))
          ? isMaintenance
            ? 'Минимальная стоимость базового регламентного ТО'
            : 'Оценка по статистике сервиса и текущим данным'
          : 'Опишите симптомы, чтобы появилась оценка';
    }
    if (sideVisitValue && sideVisitHint) {
      const visit = isMaintenance
        ? { value: 'в течение 3-7 дней', hint: 'Для планового ТО можно выбрать удобный слот' }
        : hasSym
          ? recommendVisitWindow(ext)
          : { value: '—', hint: 'Опишите симптомы, чтобы оценить срочность' };
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
      if (recs.length > 0) {
        sideRecsCard.hidden = false;
        sideRecs.innerHTML = recs
          .slice(0, 5)
          .map((r) => {
            const pct = Math.max(0, Math.min(100, Number(r.probabilityPercent) || 0));
            return `
              <div class="rec-row">
                <div class="rec-title">${escapeHtml(r.title || 'Рекомендация')}</div>
                <div class="rec-meter" aria-hidden="true"><div style="width:${pct}%"></div></div>
              </div>`;
          })
          .join('');
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
        <p style="margin:0 0 0.75rem">
          Данные для предварительной оценки собраны. Вы можете <strong>создать заявку как гость</strong> (мы свяжемся по телефону)
          или <strong>войти/зарегистрироваться</strong>, чтобы отслеживать статус и переписку в личном кабинете.
        </p>
        <p style="margin:0;display:flex;flex-wrap:wrap;gap:0.5rem">
          <button type="button" class="btn btn--primary" id="${guestRequestFormId}">Создать заявку (гость)</button>
          <a class="btn btn--ghost" href="/login.html?next=${encodeURIComponent(CONSULT_NEXT)}" style="text-decoration:none">Войти</a>
          <a class="btn btn--ghost" href="/register.html?next=${encodeURIComponent(CONSULT_NEXT)}" style="text-decoration:none">Регистрация</a>
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
          await uiAlert({ title: 'Заявка создана', message: 'Заявка создана. Смотрите статус в личном кабинете.' });
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
          await uiAlert({ title: 'Отчёт сохранён', message: 'Отчёт сохранён и доступен в личном кабинете.' });
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
  }

  async function loadSession() {
    if (!sessionId) return;
    const data = await api(`/consultations/${sessionId}`, guestApiOpts());
    renderSession(data);
  }

  async function startSession() {
    const u = getUser();
    const token = getToken();
    if (token && u?.role === 'CLIENT') {
      sessionStorage.setItem('consultMode', 'auth');
      sessionStorage.removeItem('consultGuestToken');
      const data = await api('/consultations', { method: 'POST', body: {} });
      sessionId = data.id;
      sessionStorage.setItem('consultSessionId', sessionId);
    } else {
      sessionStorage.setItem('consultMode', 'guest');
      const data = await api('/consultations', { method: 'POST', body: {}, skipAuth: true });
      sessionId = data.id;
      sessionStorage.setItem('consultSessionId', sessionId);
      if (data.guestToken) sessionStorage.setItem('consultGuestToken', data.guestToken);
    }
    await loadSession();
  }

  btnNew?.addEventListener('click', () => {
    sessionStorage.removeItem('consultSessionId');
    sessionStorage.removeItem('consultGuestToken');
    sessionId = null;
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      if (!sessionId) await startSession();
      const data = await api(`/consultations/${sessionId}/messages`, {
        method: 'POST',
        body: { content: text },
        ...guestApiOpts(),
      });
      renderSession(data);
    } catch (e) {
      if (e.status === 503) {
        errBox.textContent =
          e.data?.error || 'Модуль ИИ временно недоступен. Сообщение сохранено, попробуйте позже.';
        errBox.className = 'alert alert--error';
        errBox.hidden = false;
        if (sessionId) await loadSession().catch(() => {});
      } else if (e.status === 401 && e.data?.code === 'GUEST_TOKEN_REQUIRED') {
        // Guest token lost (e.g., sessionStorage cleared). Start a new guest session.
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
    if (sessionId) await loadSession();
    else await startSession();
  } catch (e) {
    errBox.textContent = e.message;
    errBox.className = 'alert alert--error';
    errBox.hidden = false;
  }
}
