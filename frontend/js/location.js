const MOSCOW_FARMACEVTICHESKIY_3 = [55.7938, 37.6512];

function showFallback() {
  const fb = document.getElementById('yandexMapFallback');
  if (fb) fb.hidden = false;
}

export function initLocationMap() {
  const mapEl = document.getElementById('yandexMap');
  if (!mapEl) return;

  const tryInit = () => {
    const ym = window.ymaps;
    if (!ym || typeof ym.ready !== 'function') {
      showFallback();
      return;
    }

    ym.ready(() => {
      try {
        const map = new ym.Map(
          'yandexMap',
          {
            center: MOSCOW_FARMACEVTICHESKIY_3,
            zoom: 16,
            controls: ['zoomControl', 'geolocationControl'],
          },
          {
            suppressMapOpenBlock: true,
          },
        );

        const placemark = new ym.Placemark(
          MOSCOW_FARMACEVTICHESKIY_3,
          {
            balloonContentHeader: 'AI Fox Motors',
            balloonContentBody: 'Москва, Фармацевтический проезд, 3',
            hintContent: 'AI Fox Motors',
          },
          {
            preset: 'islands#orangeDotIcon',
          },
        );

        map.geoObjects.add(placemark);
      } catch {
        showFallback();
      }
    });
  };

  if (window.ymaps) {
    tryInit();
    return;
  }

  // Wait for deferred Yandex script load.
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (window.ymaps) {
      window.clearInterval(timer);
      tryInit();
      return;
    }
    if (tries > 40) {
      window.clearInterval(timer);
      showFallback();
    }
  }, 150);
}

export function initLocationPage() {
  const form = document.getElementById('contactForm');
  const note = document.getElementById('contactFormNote');
  const nameEl = document.getElementById('contactName');
  const phoneEl = document.getElementById('contactPhone');
  if (!form || !nameEl || !phoneEl) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = String(nameEl.value || '').trim();
    const phone = String(phoneEl.value || '').trim();
    if (!name || !phone) return;
    if (note) note.hidden = false;
    form.reset();
  });
}

