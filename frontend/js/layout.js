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

  const dashClass = active === 'dash' ? 'is-active' : '';
  const authBlock = authed
    ? `<a href="${dash}" class="${dashClass}">Кабинет</a>
       <button type="button" class="btn btn--ghost" id="logoutBtn">Выход</button>`
    : `<a href="/login.html">Вход</a>
       <a href="/register.html" class="btn btn--primary" style="text-decoration:none">Регистрация</a>`;

  const header = `
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="brand" href="/index.html">
        <img
          class="brand__logo"
          src="/assets/logo.svg"
          width="40"
          height="40"
          alt=""
          decoding="async"
        />
        <span>AI Fox Motors</span>
      </a>
      <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false">Меню</button>
      <nav class="nav nav--collapsible" id="mainNav" aria-label="Основная навигация">
        <a href="/index.html" class="${active === 'home' ? 'is-active' : ''}">Главная</a>
        <a href="/about.html" class="${active === 'about' ? 'is-active' : ''}">О сервисе</a>
        <a href="/gallery.html" class="${active === 'gallery' ? 'is-active' : ''}">Галерея</a>
        <a href="/works.html" class="${active === 'works' ? 'is-active' : ''}">Работы</a>
        <a href="/location.html" class="${active === 'location' ? 'is-active' : ''}">Контакты</a>
        <a href="/consult.html" class="${active === 'consult' ? 'is-active' : ''}">ИИ-консультация</a>
        ${authBlock}
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="container">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <p style="margin:0">© ${new Date().getFullYear()} AI Fox Motors. Предварительная ИИ-оценка не заменяет диагностику на подъёмнике.</p>
        <p style="margin:0;display:flex;gap:0.75rem;align-items:center">
          <a href="/consult.html">Консультация</a>
          <a href="/location.html">Контакты</a>
        </p>
      </div>
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
