import { mountHeaderFooter } from '/js/layout.js';
import { initClientDashboard } from '/js/dashboards/client.js';

mountHeaderFooter({ active: 'dash' });
initClientDashboard();

const side = document.querySelector('.dash__side');
const t = document.getElementById('dashMenuToggle');
t?.addEventListener('click', () => side?.classList.toggle('is-open'));
