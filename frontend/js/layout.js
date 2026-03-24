import { getToken, getUser } from './api.js';

export function mountHeaderFooter({ active = '' } = {}) {
  const user = getUser();
  const authed = !!getToken() && user;

  const dash =
    user?.role === 'MANAGER'
      ? '/dashboards/manager.html'
      : user?.role === 'ADMINISTRATOR'
        ? '/dashboards/admin.html'
        : '/dashboards/client.html';

  const authBlock = authed
    ? `<a href="${dash}">Кабинет</a>
       <button type="button" class="btn btn--ghost" id="logoutBtn">Выход</button>`
    : `<a href="/login.html">Вход</a>
       <a href="/register.html" class="btn btn--primary" style="text-decoration:none">Регистрация</a>`;

  const header = `
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="brand" href="/index.html">
        <span class="brand__logo" aria-hidden="true"></span>
        <span>AI Fox Motors</span>
      </a>
      <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false">Меню</button>
      <nav class="nav nav--collapsible" id="mainNav" aria-label="Основная навигация">
        <a href="/index.html" class="${active === 'home' ? 'is-active' : ''}">Главная</a>
        <a href="/about.html">О сервисе</a>
        <a href="/gallery.html">Галерея</a>
        <a href="/works.html">Работы</a>
        <a href="/location.html">Контакты</a>
        <a href="/consult.html">ИИ-консультация</a>
        ${authBlock}
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="container">
      <p>© ${new Date().getFullYear()} AI Fox Motors. Предварительная ИИ-оценка не заменяет диагностику на подъёмнике.</p>
    </div>
  </footer>`;

  const ph = document.getElementById('header-placeholder');
  const pf = document.getElementById('footer-placeholder');
  if (ph) ph.outerHTML = header;
  if (pf) pf.outerHTML = footer;

  document.getElementById('navToggle')?.addEventListener('click', () => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    nav?.classList.toggle('is-open');
    btn?.setAttribute('aria-expanded', nav?.classList.contains('is-open') ? 'true' : 'false');
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });
}
