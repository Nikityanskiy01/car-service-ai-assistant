import { api } from './api.js';
import { requireAuth } from './router-guard.js';
import { $, escapeHtml, formatDate } from './utils.js';

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

export async function initConsultPage() {
  const user = requireAuth(['CLIENT']);
  if (!user) return;

  const chatEl = $('#chat');
  const form = $('#chatForm');
  const input = $('#messageInput');
  const progressBar = $('#progressBar');
  const progressLabel = $('#progressLabel');
  const errBox = $('#consultError');
  const actions = $('#consultActions');
  const btnNew = $('#btnNewSession');

  let sessionId = sessionStorage.getItem('consultSessionId');

  function renderSession(data) {
    errBox.textContent = '';
    errBox.className = 'alert';
    const p = data.progressPercent ?? 0;
    progressBar.style.width = `${p}%`;
    progressLabel.textContent = `Готовность данных: ${p}%`;

    chatEl.innerHTML = '';
    (data.messages || []).forEach((m) => {
      const div = document.createElement('div');
      div.className = `bubble ${m.sender === 'USER' ? 'bubble--user' : 'bubble--assistant'}`;
      div.innerHTML = escapeHtml(m.content);
      chatEl.appendChild(div);
    });
    chatEl.scrollTop = chatEl.scrollHeight;

    const ext = data.extracted;
    const done = sixComplete(ext) || data.serviceRequest;
    actions.innerHTML = '';
    if (done && !data.serviceRequest) {
      const b1 = document.createElement('button');
      b1.className = 'btn btn--primary';
      b1.type = 'button';
      b1.textContent = 'Оформить заявку в сервис';
      b1.addEventListener('click', async () => {
        try {
          await api(`/consultations/${sessionId}/service-request`, { method: 'POST' });
          alert('Заявка создана. Смотрите статус в личном кабинете.');
          window.location.href = '/dashboards/client.html';
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
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
          alert('Отчёт сохранён на сервере.');
        } catch (e) {
          errBox.textContent = e.message;
          errBox.className = 'alert alert--error';
        }
      });
      actions.append(b1, b2);
    } else if (data.serviceRequest) {
      const p = document.createElement('p');
      p.textContent = 'По этой консультации заявка уже создана.';
      actions.appendChild(p);
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
    const data = await api(`/consultations/${sessionId}`);
    renderSession(data);
  }

  async function startSession() {
    const data = await api('/consultations', { method: 'POST', body: {} });
    sessionId = data.id;
    sessionStorage.setItem('consultSessionId', sessionId);
    await loadSession();
  }

  btnNew?.addEventListener('click', () => {
    sessionStorage.removeItem('consultSessionId');
    sessionId = null;
    chatEl.innerHTML = '';
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Готовность данных: 0%';
    actions.innerHTML = '';
    startSession().catch((e) => {
      errBox.textContent = e.message;
      errBox.className = 'alert alert--error';
    });
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
      });
      renderSession(data);
    } catch (e) {
      if (e.status === 503) {
        errBox.textContent =
          e.data?.error || 'Модуль ИИ временно недоступен. Сообщение сохранено, попробуйте позже.';
        errBox.className = 'alert alert--error';
        if (sessionId) await loadSession().catch(() => {});
      } else {
        errBox.textContent = e.message;
        errBox.className = 'alert alert--error';
      }
    }
  });

  try {
    if (sessionId) await loadSession();
    else await startSession();
  } catch (e) {
    errBox.textContent = e.message;
    errBox.className = 'alert alert--error';
  }
}
