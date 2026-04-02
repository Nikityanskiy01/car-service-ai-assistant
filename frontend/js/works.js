import { $$ } from './utils.js';

export function initWorksPage() {
  const filterButtons = $$('.works-pro__filters [data-filter]');
  const items = $$('#worksGrid .work-item');
  if (!filterButtons.length || !items.length) return;

  function applyFilter(filter) {
    items.forEach((item) => {
      item.hidden = item.dataset.category !== filter;
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      applyFilter(filter);
    });
  });

  // Show first category by default (engine).
  applyFilter(filterButtons[0].dataset.filter);
}

