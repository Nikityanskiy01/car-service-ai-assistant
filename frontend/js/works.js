import { $$ } from './utils.js';

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

