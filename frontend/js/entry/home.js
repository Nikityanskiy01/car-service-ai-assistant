import { mountHeaderFooter } from '/js/layout.js';
import { initHomeServicesBooking } from '/js/services-page.js';

mountHeaderFooter({ active: 'home' });
initHomeServicesBooking();

const COORDS = [55.833717, 37.517398];

function initHomeMap() {
  const ym = window.ymaps;
  if (!ym) return;
  ym.ready(() => {
    const map = new ym.Map(
      'homeMap',
      {
        center: COORDS,
        zoom: 17,
        controls: ['zoomControl'],
      },
      { suppressMapOpenBlock: true },
    );
    map.geoObjects.add(
      new ym.Placemark(
        COORDS,
        {
          balloonContentHeader: 'Fox Motors',
          balloonContentBody: 'Москва, Фармацевтический проезд, 3',
          hintContent: 'Fox Motors',
        },
        { preset: 'islands#orangeAutoIcon' },
      ),
    );
  });
}

if (window.ymaps) {
  initHomeMap();
} else {
  let t = 0;
  const iv = setInterval(() => {
    if (window.ymaps) {
      clearInterval(iv);
      initHomeMap();
    }
    if (++t > 40) clearInterval(iv);
  }, 150);
}
