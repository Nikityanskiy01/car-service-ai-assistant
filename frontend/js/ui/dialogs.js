import { escapeHtml } from '../utils.js';

function ensureDialogRoot() {
  let root = document.getElementById('uiDialogRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'uiDialogRoot';
  document.body.appendChild(root);
  return root;
}

function mountModal({ title, bodyHtml, actionsHtml }) {
  const root = ensureDialogRoot();
  root.innerHTML = `
    <div class="ui-modal__backdrop" data-ui-close="1" role="presentation">
      <div class="ui-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || 'Диалог')}">
        <div class="ui-modal__head">
          <div class="ui-modal__title">${escapeHtml(title || '')}</div>
          <button type="button" class="ui-modal__x" aria-label="Закрыть" data-ui-close="1">×</button>
        </div>
        <div class="ui-modal__body">${bodyHtml || ''}</div>
        <div class="ui-modal__actions">${actionsHtml || ''}</div>
      </div>
    </div>
  `;
  return root;
}

function closeModal() {
  const root = document.getElementById('uiDialogRoot');
  if (root) root.innerHTML = '';
}

function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  function onKey(e) {
    if (e.key === 'Escape') {
      const close = modalEl.querySelector('[data-ui-close="1"]');
      close?.click();
      return;
    }
    if (e.key !== 'Tab' || focusable.length === 0) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  modalEl.addEventListener('keydown', onKey);
  first?.focus();
  return () => modalEl.removeEventListener('keydown', onKey);
}

export function uiAlert({ title = 'Готово', message = '' } = {}) {
  return new Promise((resolve) => {
    const bodyHtml = `<p style="margin:0">${escapeHtml(message)}</p>`;
    const actionsHtml = `<button type="button" class="btn btn--primary" id="uiOkBtn">Ок</button>`;
    const root = mountModal({ title, bodyHtml, actionsHtml });
    const backdrop = root.querySelector('.ui-modal__backdrop');
    const modal = root.querySelector('.ui-modal');
    const cleanupFocus = trapFocus(modal);

    function done() {
      cleanupFocus?.();
      closeModal();
      resolve();
    }

    root.querySelector('#uiOkBtn')?.addEventListener('click', done);
    backdrop?.addEventListener('click', (e) => {
      if (e.target?.dataset?.uiClose === '1') done();
    });
    root.querySelectorAll('[data-ui-close="1"]').forEach((el) => el.addEventListener('click', done));
  });
}

export function uiPromptContact({ title = 'Контакты для заявки', fullName = '', phone = '' } = {}) {
  return new Promise((resolve) => {
    const bodyHtml = `
      <div class="stack" style="gap:0.75rem">
        <div class="form-field" style="margin:0">
          <label for="uiFullName">Как к вам обращаться</label>
          <input id="uiFullName" value="${escapeHtml(fullName)}" placeholder="Имя" />
        </div>
        <div class="form-field" style="margin:0">
          <label for="uiPhone">Телефон</label>
          <input id="uiPhone" value="${escapeHtml(phone)}" placeholder="+7..." />
        </div>
        <p class="muted" style="margin:0">
          Регистрация нужна для отслеживания статуса заявки и сохранения отчётов.
        </p>
      </div>
    `;
    const actionsHtml = `
      <button type="button" class="btn btn--ghost" id="uiCancelBtn">Отмена</button>
      <button type="button" class="btn btn--primary" id="uiSubmitBtn">Создать заявку</button>
    `;
    const root = mountModal({ title, bodyHtml, actionsHtml });
    const backdrop = root.querySelector('.ui-modal__backdrop');
    const modal = root.querySelector('.ui-modal');
    const cleanupFocus = trapFocus(modal);

    const nameEl = root.querySelector('#uiFullName');
    const phoneEl = root.querySelector('#uiPhone');

    function cancel() {
      cleanupFocus?.();
      closeModal();
      resolve(null);
    }

    function submit() {
      const name = String(nameEl?.value || '').trim();
      const ph = String(phoneEl?.value || '').trim();
      if (!name || !ph) {
        phoneEl?.focus();
        return;
      }
      cleanupFocus?.();
      closeModal();
      resolve({ fullName: name, phone: ph });
    }

    root.querySelector('#uiCancelBtn')?.addEventListener('click', cancel);
    root.querySelector('#uiSubmitBtn')?.addEventListener('click', submit);
    backdrop?.addEventListener('click', (e) => {
      if (e.target?.dataset?.uiClose === '1') cancel();
    });
    root.querySelectorAll('[data-ui-close="1"]').forEach((el) => el.addEventListener('click', cancel));

    modal?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  });
}

export function uiConfirm({
  title = 'Подтвердите действие',
  message = '',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
} = {}) {
  return new Promise((resolve) => {
    const bodyHtml = `<p style="margin:0">${escapeHtml(message)}</p>`;
    const actionsHtml = `
      <button type="button" class="btn btn--ghost" id="uiCancelBtn">${escapeHtml(cancelText)}</button>
      <button type="button" class="btn btn--primary" id="uiConfirmBtn">${escapeHtml(confirmText)}</button>
    `;
    const root = mountModal({ title, bodyHtml, actionsHtml });
    const backdrop = root.querySelector('.ui-modal__backdrop');
    const modal = root.querySelector('.ui-modal');
    const cleanupFocus = trapFocus(modal);

    function cancel() {
      cleanupFocus?.();
      closeModal();
      resolve(false);
    }

    function confirm() {
      cleanupFocus?.();
      closeModal();
      resolve(true);
    }

    root.querySelector('#uiCancelBtn')?.addEventListener('click', cancel);
    root.querySelector('#uiConfirmBtn')?.addEventListener('click', confirm);
    backdrop?.addEventListener('click', (e) => {
      if (e.target?.dataset?.uiClose === '1') cancel();
    });
    root.querySelectorAll('[data-ui-close="1"]').forEach((el) => el.addEventListener('click', cancel));
  });
}

export function uiPromptText({
  title = 'Введите значение',
  label = 'Значение',
  placeholder = '',
  initialValue = '',
  submitText = 'Сохранить',
  cancelText = 'Отмена',
  multiline = false,
} = {}) {
  return new Promise((resolve) => {
    const inputId = 'uiPromptValue';
    const field =
      multiline
        ? `<textarea id="${inputId}" rows="4" placeholder="${escapeHtml(placeholder)}">${escapeHtml(initialValue)}</textarea>`
        : `<input id="${inputId}" value="${escapeHtml(initialValue)}" placeholder="${escapeHtml(placeholder)}" />`;
    const bodyHtml = `
      <div class="stack" style="gap:0.75rem">
        <div class="form-field" style="margin:0">
          <label for="${inputId}">${escapeHtml(label)}</label>
          ${field}
        </div>
      </div>
    `;
    const actionsHtml = `
      <button type="button" class="btn btn--ghost" id="uiCancelBtn">${escapeHtml(cancelText)}</button>
      <button type="button" class="btn btn--primary" id="uiSubmitBtn">${escapeHtml(submitText)}</button>
    `;
    const root = mountModal({ title, bodyHtml, actionsHtml });
    const backdrop = root.querySelector('.ui-modal__backdrop');
    const modal = root.querySelector('.ui-modal');
    const cleanupFocus = trapFocus(modal);
    const input = root.querySelector(`#${inputId}`);

    function cancel() {
      cleanupFocus?.();
      closeModal();
      resolve(null);
    }

    function submit() {
      const v = String(input?.value || '');
      cleanupFocus?.();
      closeModal();
      resolve(v);
    }

    root.querySelector('#uiCancelBtn')?.addEventListener('click', cancel);
    root.querySelector('#uiSubmitBtn')?.addEventListener('click', submit);
    backdrop?.addEventListener('click', (e) => {
      if (e.target?.dataset?.uiClose === '1') cancel();
    });
    root.querySelectorAll('[data-ui-close="1"]').forEach((el) => el.addEventListener('click', cancel));

    modal?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        submit();
      }
    });
  });
}

