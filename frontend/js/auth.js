import { api, setUser } from './api.js';
import { attachPhoneInputMask, isValidPhoneInput } from './phone.js';
import { $ } from './utils.js';

function dashboardForRole(role) {
  if (role === 'MANAGER') return '/dashboards/manager.html';
  if (role === 'ADMINISTRATOR') return '/dashboards/admin.html';
  return '/dashboards/client.html';
}

function markField(el, valid) {
  const field = el?.closest('.form-field');
  if (!field) return;
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid);
}

function resetFields(form) {
  form.querySelectorAll('.form-field').forEach((f) => {
    f.classList.remove('is-invalid', 'is-valid');
  });
}

function syncPwToggleUi(btn, passwordHidden) {
  const showIcon = btn.querySelector('.pw-toggle__icon--show');
  const hideIcon = btn.querySelector('.pw-toggle__icon--hide');
  if (showIcon && hideIcon) {
    if (passwordHidden) {
      showIcon.removeAttribute('hidden');
      hideIcon.setAttribute('hidden', '');
    } else {
      hideIcon.removeAttribute('hidden');
      showIcon.setAttribute('hidden', '');
    }
  }
  btn.setAttribute('aria-label', passwordHidden ? 'Показать пароль' : 'Скрыть пароль');
}

function initPwToggles() {
  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    const scope = btn.closest('.pw-input-wrap') || btn.closest('.form-field');
    const input = scope?.querySelector('input');
    if (input) syncPwToggleUi(btn, input.type === 'password');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sc = btn.closest('.pw-input-wrap') || btn.closest('.form-field');
      const inp = sc?.querySelector('input');
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      syncPwToggleUi(btn, inp.type === 'password');
    });
  });
}

function isValidEmail(email) {
  const v = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);
}

const PASSWORD_POLICY_HINT =
  'Пароль: не менее 8 символов, латинские буквы и цифры; кириллица не допускается';

const CYRILLIC_IN_PASSWORD = /[А-Яа-яЁё]/g;

function passwordMeetsRegistrationPolicy(password) {
  const s = String(password || '');
  if (s.length < 8) return false;
  if (/[А-Яа-яЁё]/.test(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  return true;
}

/** Убирает кириллицу из поля пароля (вход и регистрация). */
function bindLatinPasswordOnly(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const v = input.value;
    const next = v.replace(CYRILLIC_IN_PASSWORD, '');
    if (next === v) return;
    const start = input.selectionStart ?? v.length;
    const before = v.slice(0, start);
    const removedBefore = before.replace(CYRILLIC_IN_PASSWORD, '').length;
    const diff = before.length - removedBefore;
    input.value = next;
    const pos = Math.max(0, start - diff);
    input.setSelectionRange(pos, pos);
  });
}

function passwordStrength(password) {
  const p = String(password || '');
  let score = 0;
  if (p.length >= 8) score += 1;
  if (/[A-Z]/.test(p)) score += 1;
  if (/[a-z]/.test(p)) score += 1;
  if (/\d/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;
  if (p.length >= 12) score += 1;
  if (score <= 2) return { pct: 33, text: 'Надёжность: слабый', color: '#ef4444' };
  if (score <= 4) return { pct: 66, text: 'Надёжность: средний', color: '#f59e0b' };
  return { pct: 100, text: 'Надёжность: сильный', color: '#22c55e' };
}

export function initRegister() {
  const form = $('#registerForm');
  if (!form) return;
  const err = $('#formError');
  const emailEl = $('#email');
  const passwordEl = $('#password');
  const fullNameEl = $('#fullName');
  const phoneEl = $('#phone');
  const pwBar = $('#passwordStrengthBar');
  const pwText = $('#passwordStrengthText');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  const loginLink = document.getElementById('registerLoginLink');
  if (loginLink && next) {
    loginLink.href = `/login.html?next=${encodeURIComponent(next)}`;
  }

  initPwToggles();
  bindLatinPasswordOnly(passwordEl);

  function setError(message) {
    err.textContent = message;
    err.className = 'alert alert--error';
    err.hidden = false;
  }

  function clearError() {
    err.textContent = '';
    err.className = 'alert';
    err.hidden = true;
  }

  if (phoneEl) {
    attachPhoneInputMask(phoneEl);
    phoneEl.addEventListener('blur', () => {
      const v = String(phoneEl.value || '').trim();
      if (!v) return;
      markField(phoneEl, isValidPhoneInput(v));
    });
  }

  if (emailEl) {
    emailEl.addEventListener('blur', () => {
      const v = emailEl.value.trim();
      if (v) markField(emailEl, isValidEmail(v));
    });
  }

  if (passwordEl && pwBar && pwText) {
    passwordEl.addEventListener('input', () => {
      const s = passwordStrength(passwordEl.value);
      pwBar.style.width = `${s.pct}%`;
      pwBar.style.background = s.color;
      pwText.textContent = s.text;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    resetFields(form);
    const email = String(emailEl?.value || '').trim();
    const password = String(passwordEl?.value || '');
    const phoneVal = String(phoneEl?.value || '').trim();
    const fullName = String(fullNameEl?.value || '').trim();

    let hasErr = false;
    if (!isValidEmail(email)) {
      markField(emailEl, false);
      if (!hasErr) { emailEl?.focus(); hasErr = true; }
    }
    if (!fullName) {
      markField(fullNameEl, false);
      if (!hasErr) { fullNameEl?.focus(); hasErr = true; }
    }
    if (!phoneVal || !isValidPhoneInput(phoneVal)) {
      markField(phoneEl, false);
      if (!hasErr) { phoneEl?.focus(); hasErr = true; }
    } else {
      markField(phoneEl, true);
    }
    if (!passwordMeetsRegistrationPolicy(password)) {
      markField(passwordEl, false);
      setError(PASSWORD_POLICY_HINT);
      if (!hasErr) passwordEl?.focus();
      hasErr = true;
    }
    if (hasErr) return;

    try {
      const fd = new FormData(form);
      const body = {
        email,
        password,
        fullName: fd.get('fullName'),
        phone: phoneVal,
      };
      const data = await api('/auth/register', { method: 'POST', body, skipCsrf: true, skipAuth: true });
      setUser(data.user);
      window.location.href = next || dashboardForRole(data.user.role);
    } catch (ex) {
      setError(ex.message || 'Ошибка регистрации');
    }
  });
}

export function initLogin() {
  const form = $('#loginForm');
  if (!form) return;
  const err = $('#formError');
  const emailEl = $('#email');
  const passwordEl = $('#password');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');

  initPwToggles();
  bindLatinPasswordOnly(passwordEl);

  function setError(message) {
    err.textContent = message;
    err.className = 'alert alert--error';
    err.hidden = false;
  }

  function clearError() {
    err.textContent = '';
    err.className = 'alert';
    err.hidden = true;
  }

  if (emailEl) {
    emailEl.addEventListener('blur', () => {
      const v = emailEl.value.trim();
      if (v) markField(emailEl, isValidEmail(v));
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    resetFields(form);
    const email = String(emailEl?.value || '').trim();
    const password = String(passwordEl?.value || '');

    let hasErr = false;
    if (!isValidEmail(email)) {
      markField(emailEl, false);
      if (!hasErr) { emailEl?.focus(); hasErr = true; }
    }
    if (!password) {
      markField(passwordEl, false);
      if (!hasErr) { passwordEl?.focus(); hasErr = true; }
    }
    if (hasErr) return;

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipCsrf: true,
        skipAuth: true,
      });
      setUser(data.user);
      window.location.href = next || dashboardForRole(data.user.role);
    } catch (ex) {
      setError(ex.message || 'Неверный логин или пароль');
    }
  });
}
