import { mountHeaderFooter } from '/js/layout.js';
import { initManagerDashboard } from '/js/dashboards/manager.js';

mountHeaderFooter({ active: 'dash' });
initManagerDashboard();

const side = document.querySelector('.dash__side');
const t = document.getElementById('dashMenuToggle');
t?.addEventListener('click', () => side?.classList.toggle('is-open'));
