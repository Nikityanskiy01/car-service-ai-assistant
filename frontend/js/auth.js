import { api, setToken, setUser } from './api.js';
import { $ } from './utils.js';

function dashboardForRole(role) {
  if (role === 'MANAGER') return '/dashboards/manager.html';
  if (role === 'ADMINISTRATOR') return '/dashboards/admin.html';
  return '/dashboards/client.html';
}

export function initRegister() {
  const form = $('#registerForm');
  if (!form) return;
  const err = $('#formError');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    err.className = 'alert';
    try {
      const fd = new FormData(form);
      const body = {
        email: fd.get('email'),
        password: fd.get('password'),
        fullName: fd.get('fullName'),
        phone: fd.get('phone'),
      };
      const data = await api('/auth/register', { method: 'POST', body });
      setToken(data.accessToken);
      setUser(data.user);
      window.location.href = dashboardForRole(data.user.role);
    } catch (ex) {
      err.textContent = ex.message || 'Ошибка регистрации';
      err.className = 'alert alert--error';
    }
  });
}

export function initLogin() {
  const form = $('#loginForm');
  if (!form) return;
  const err = $('#formError');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    err.className = 'alert';
    try {
      const fd = new FormData(form);
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: fd.get('email'), password: fd.get('password') },
      });
      setToken(data.accessToken);
      setUser(data.user);
      window.location.href = next || dashboardForRole(data.user.role);
    } catch (ex) {
      err.textContent = ex.message || 'Неверный логин или пароль';
      err.className = 'alert alert--error';
    }
  });
}
