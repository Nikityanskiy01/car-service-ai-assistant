import { mountHeaderFooter } from '/js/layout.js';
import { initAdminDashboard } from '/js/dashboards/admin.js';

mountHeaderFooter({ active: 'dash' });
initAdminDashboard();

const side = document.querySelector('.dash__side');
const t = document.getElementById('dashMenuToggle');
t?.addEventListener('click', () => side?.classList.toggle('is-open'));
