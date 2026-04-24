import { $$ } from './utils.js';

function esc(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function initWorksPage() {
  const filterButtons = $$('.works-pro__filters [data-filter]');
  const items = $$('#worksGrid .work-item');
  if (!filterButtons.length || !items.length) return;

  function applyFilter(filter) {
    items.forEach((item) => {
      item.hidden = item.dataset.category !== filter;
    });
    filterButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.filter === filter));
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyFilter(btn.dataset.filter);
      history.replaceState(null, '', '#' + btn.dataset.filter);
    });
  });

  items.forEach((item) => {
    const btn = item.querySelector('.work-item__toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const details = item.querySelector('.work-item__details');
      if (!details) return;
      const expanded = details.hidden;
      details.hidden = !expanded;
      btn.textContent = expanded ? 'Свернуть' : 'Подробнее';
    });
  });

  const hash = location.hash.replace('#', '');
  const validFilter = filterButtons.some((b) => b.dataset.filter === hash);
  applyFilter(validFilter ? hash : filterButtons[0].dataset.filter);
}

export async function mountCmsWorks() {
  const root = document.getElementById('worksGrid');
  if (!root) return;
  try {
    const res = await fetch('/api/content/site-items?kind=work', { credentials: 'include' });
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) return;
    root.insertAdjacentHTML(
      'beforeend',
      items
      .map(
        (it) => `<article class="card work-item" data-category="${esc(String(it.category || 'results').toLowerCase())}">
      ${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="${esc(it.title || 'Работа')}" loading="lazy" />` : ''}
      <h3>${esc(it.title || '')}</h3>
      ${it.problem ? `<p><strong>Проблема:</strong> ${esc(it.problem)}</p>` : ''}
      ${it.price ? `<p><strong>Стоимость:</strong> ${esc(it.price)}</p>` : ''}
      <button type="button" class="btn btn--ghost work-item__toggle">Подробнее</button>
      <div class="work-item__details" hidden>
        ${it.description ? `<p>${esc(it.description)}</p>` : ''}
        ${it.result ? `<p><strong>Результат:</strong> ${esc(it.result)}</p>` : ''}
        ${it.term ? `<p><strong>Срок:</strong> ${esc(it.term)}</p>` : ''}
      </div>
    </article>`,
      )
      .join(''),
    );
  } catch {
    /* ignore */
  }
}

