import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'frontend/assets/placeholders');
fs.mkdirSync(dir, { recursive: true });

const gallery = [
  'Зона приёма клиентов',
  'Пост первичной диагностики',
  'Профессиональное оборудование',
  'Автомобиль после ТО',
  'Результат ремонта подвески',
  'Стенд проверки',
  'Ремонтная зона',
  'После комплексной диагностики',
];

const works = [
  ['Volkswagen Tiguan', 'Диагностика двигателя'],
  ['Skoda Octavia', 'Ремонт подвески'],
  ['Kia Sportage', 'Тормозная система'],
  ['BMW 5 Series', 'Электрика'],
  ['Audi A6', 'Трансмиссия'],
  ['Toyota Camry', 'Плановое ТО'],
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function writeSvg(title, sub, g1, g2, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${g1}"/><stop offset="100%" stop-color="${g2}"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><text x="600" y="310" fill="#f5f7fb" font-family="Arial,sans-serif" font-size="40" text-anchor="middle">${esc(title)}</text><text x="600" y="370" fill="#ff6b35" font-family="Arial,sans-serif" font-size="24" text-anchor="middle">${esc(sub)}</text></svg>`;
  fs.writeFileSync(path.join(dir, file), svg);
}

gallery.forEach((t, i) => writeSvg(t, 'Fox Motors', '#1a1f2e', '#2d3548', `gallery-${String(i + 1).padStart(2, '0')}.svg`));
works.forEach(([t, s], i) => writeSvg(t, s, '#1f2433', '#3a2a24', `works-${String(i + 1).padStart(2, '0')}.svg`));

console.log('Generated', fs.readdirSync(dir).length, 'files in', dir);
