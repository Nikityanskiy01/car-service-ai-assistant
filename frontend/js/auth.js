import { api, setToken, setUser } from './api.js';
import { $ } from './utils.js';

function dashboardForRole(role) {
  if (role === 'MANAGER') return '/dashboards/manager.html';
  if (role === 'ADMINISTRATOR') return '/dashboards/admin.html';
  return '/dashboards/client.html';
}

function isValidEmail(email) {
  const v = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);
}

function normalizePhoneRaw(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  let d = digits;
  if (d[0] !== '8') d = `8${d.slice(1)}`;
  return d.slice(0, 11);
}

function formatPhoneMask(raw) {
  const d = normalizePhoneRaw(raw);
  if (!d) return '';
  const parts = [d.slice(0, 1)];
  if (d.length > 1) parts.push(d.slice(1, 4));
  if (d.length > 4) parts.push(d.slice(4, 7));
  if (d.length > 7) parts.push(d.slice(7, 9));
  if (d.length > 9) parts.push(d.slice(9, 11));
  return parts.join('-');
}

function passwordStrength(password) {
  const p = String(password || '');
  let score = 0;
  if (p.length >= 8) score += 1;
  if (/[A-ZА-Я]/.test(p)) score += 1;
  if (/[a-zа-я]/.test(p)) score += 1;
  if (/\d/.test(p)) score += 1;
  if (/[^A-Za-zА-Яа-я0-9]/.test(p)) score += 1;
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
  const phoneEl = $('#phone');
  const pwBar = $('#passwordStrengthBar');
  const pwText = $('#passwordStrengthText');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  const loginLink = document.getElementById('registerLoginLink');
  if (loginLink && next) {
    loginLink.href = `/login.html?next=${encodeURIComponent(next)}`;
  }

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
    phoneEl.addEventListener('input', () => {
      phoneEl.value = formatPhoneMask(phoneEl.value);
    });
    phoneEl.addEventListener('blur', () => {
      const digits = normalizePhoneRaw(phoneEl.value);
      if (digits.length > 0 && digits.length !== 11) {
        setError('Телефон должен быть в формате 8-999-999-99-99 (11 цифр).');
      }
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
    const email = String(emailEl?.value || '').trim();
    const password = String(passwordEl?.value || '');
    const phoneMasked = String(phoneEl?.value || '');
    const phoneDigits = normalizePhoneRaw(phoneMasked);

    if (!isValidEmail(email)) {
      setError('Введите корректный email, например: name@example.com');
      emailEl?.focus();
      return;
    }
    if (phoneDigits.length !== 11) {
      setError('Телефон должен быть в формате 8-999-999-99-99 (11 цифр).');
      phoneEl?.focus();
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.');
      passwordEl?.focus();
      return;
    }

    try {
      const fd = new FormData(form);
      const body = {
        email,
        password,
        fullName: fd.get('fullName'),
        phone: formatPhoneMask(phoneDigits),
      };
      const data = await api('/auth/register', { method: 'POST', body });
      setToken(data.accessToken);
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const email = String(emailEl?.value || '').trim();
    const password = String(passwordEl?.value || '');
    if (!isValidEmail(email)) {
      setError('Введите корректный email, например: name@example.com');
      emailEl?.focus();
      return;
    }
    if (!password) {
      setError('Введите пароль.');
      passwordEl?.focus();
      return;
    }
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.accessToken);
      setUser(data.user);
      window.location.href = next || dashboardForRole(data.user.role);
    } catch (ex) {
      setError(ex.message || 'Неверный логин или пароль');
    }
  });
}
