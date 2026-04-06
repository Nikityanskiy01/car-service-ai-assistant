import { api, getUser, clearAuth } from './api.js';

function loadLucide() {
  return new Promise((resolve) => {
    if (window.lucide) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js';
    s.integrity = 'sha384-ieG+IKD0d/ZPXyCBTMVAbqsQdns8QGJR/e26WMw7M4fkaI/rHcS/YIoi+ah9WGge';
    s.crossOrigin = 'anonymous';
    s.onload = () => { window.lucide.createIcons(); resolve(); };
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export function mountHeaderFooter({ active = '' } = {}) {
  const user = getUser();
  const authed = !!user;

  const dash =
    user?.role === 'MANAGER'
      ? '/dashboards/manager.html'
      : user?.role === 'ADMINISTRATOR'
        ? '/dashboards/admin.html'
        : '/dashboards/client.html';

  const dashClass = active === 'dash' ? 'is-active' : '';
  const navCta = '';
  const authBlock = authed
    ? `<a href="${dash}" class="${dashClass}">Кабинет</a>
       <button type="button" class="btn btn--ghost" id="logoutBtn">Выход</button>`
    : `<div class="nav-auth">
         <a href="/login.html" class="btn btn--primary">Вход</a>
         <a href="/register.html" class="btn btn--primary">Регистрация</a>
       </div>`;

  const hamburgerSvg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const closeSvg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

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
        <span>Fox Motors</span>
      </a>
      <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-label="Открыть меню">${hamburgerSvg}</button>
      <nav class="nav nav--collapsible" id="mainNav" aria-label="Основная навигация">
        <a href="/index.html" class="${active === 'home' ? 'is-active' : ''}">Главная</a>
        <a href="/services.html" class="${active === 'services' ? 'is-active' : ''}">Услуги</a>
        <a href="/consult.html" class="${active === 'consult' ? 'is-active' : ''}">ИИ-консультация</a>
        <a href="/works.html" class="${active === 'works' ? 'is-active' : ''}">Работы</a>
        <a href="/gallery.html" class="${active === 'gallery' ? 'is-active' : ''}">Галерея</a>
        <a href="/about.html#contacts" class="${active === 'about' || active === 'location' ? 'is-active' : ''}">О сервисе и контакты</a>
        ${navCta}
        ${authBlock}
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <p class="site-footer__copy">&copy; ${new Date().getFullYear()} Fox Motors</p>
          <p class="site-footer__tagline">Предварительная ИИ-оценка не заменяет диагностику на подъёмнике.</p>
        </div>
        <nav class="site-footer__nav" aria-label="Навигация подвала">
          <a href="/consult.html">Консультация</a>
          <a href="/about.html#contacts">О сервисе и контакты</a>
          <a href="/services.html">Услуги</a>
          <a href="/works.html">Работы</a>
          <a href="/gallery.html">Галерея</a>
        </nav>
      </div>
    </div>
  </footer>`;

  const ph = document.getElementById('header-placeholder');
  const pf = document.getElementById('footer-placeholder');
  if (ph) ph.outerHTML = header;
  if (pf) pf.outerHTML = footer;

  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');

  navToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = mainNav?.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.innerHTML = open ? closeSvg : hamburgerSvg;
  });

  document.addEventListener('click', (e) => {
    if (!mainNav?.classList.contains('is-open')) return;
    if (e.target.closest('.nav--collapsible')) return;
    mainNav.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    if (navToggle) navToggle.innerHTML = hamburgerSvg;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mainNav?.classList.contains('is-open')) {
      mainNav.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');
      if (navToggle) navToggle.innerHTML = hamburgerSvg;
      navToggle?.focus();
    }
  });

  mainNav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!mainNav.classList.contains('is-open')) return;
      mainNav.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');
      if (navToggle) navToggle.innerHTML = hamburgerSvg;
    });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* сервер мог уже очистить сессию */
    }
    clearAuth();
    window.location.href = '/index.html';
  });

  loadLucide();
}
