import { mountHeaderFooter } from '/js/layout.js';

mountHeaderFooter();
const box = document.getElementById('err403Box');
if (box) {
  const p = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  box.textContent = `Запрошенный адрес: ${p}`;
}
