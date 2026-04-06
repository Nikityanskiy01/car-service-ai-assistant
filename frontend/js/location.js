import { api } from './api.js';
import { attachPhoneInputMask, isValidPhoneInput } from './phone.js';

const FOX_MOTORS_COORDS = [55.833717, 37.517398];
const YANDEX_MAPS_SCRIPT_SRC = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';

let yandexMapsScriptPromise = null;

function showFallback() {
  const fb = document.getElementById('yandexMapFallback');
  if (fb) fb.hidden = false;
}

/** Однократная подгрузка API карт (без тега в HTML — меньше блокировок при первой отрисовке). */
export function ensureYandexMapsScript() {
  if (typeof window !== 'undefined' && window.ymaps) {
    return Promise.resolve();
  }
  if (yandexMapsScriptPromise) return yandexMapsScriptPromise;

  yandexMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ymaps-api="1"]');
    if (existing) {
      if (window.ymaps) {
        resolve();
        return;
      }
      const onLoad = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onErr);
        resolve();
      };
      const onErr = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onErr);
        reject(new Error('Yandex Maps'));
      };
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onErr);
      return;
    }

    const s = document.createElement('script');
    s.src = YANDEX_MAPS_SCRIPT_SRC;
    s.async = true;
    s.dataset.ymapsApi = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Yandex Maps'));
    document.head.appendChild(s);
  });

  return yandexMapsScriptPromise;
}

export async function initLocationMapLazy() {
  const mapEl = document.getElementById('yandexMap');
  if (!mapEl || mapEl.dataset.mapInitialized === '1') return;
  try {
    await ensureYandexMapsScript();
  } catch {
    showFallback();
    return;
  }
  initLocationMap();
}

export function initLocationMap() {
  const mapEl = document.getElementById('yandexMap');
  if (!mapEl || mapEl.dataset.mapInitialized === '1') return;

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
            center: FOX_MOTORS_COORDS,
            zoom: 17,
            controls: ['zoomControl', 'geolocationControl'],
          },
          { suppressMapOpenBlock: true },
        );

        const placemark = new ym.Placemark(
          FOX_MOTORS_COORDS,
          {
            balloonContentHeader: 'Fox Motors',
            balloonContentBody: 'Москва, Фармацевтический проезд, 3',
            hintContent: 'Fox Motors',
          },
          { preset: 'islands#orangeAutoIcon' },
        );

        map.geoObjects.add(placemark);
        mapEl.dataset.mapInitialized = '1';
      } catch {
        showFallback();
      }
    });
  };

  if (window.ymaps) {
    tryInit();
    return;
  }

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

function markField(el, valid) {
  const field = el?.closest('.form-field');
  if (!field) return;
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid);
}

export function initLocationPage() {
  const form = document.getElementById('contactForm');
  const note = document.getElementById('contactFormNote');
  const errBanner = document.getElementById('contactFormError');
  const nameEl = document.getElementById('contactName');
  const phoneEl = document.getElementById('contactPhone');
  const msgEl = document.getElementById('contactMessage');
  const submitBtn = document.getElementById('contactSubmitBtn');
  if (!form || !nameEl || !phoneEl) return;

  attachPhoneInputMask(phoneEl);

  const defaultSubmitLabel = submitBtn?.textContent || 'Отправить';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (note) note.hidden = true;
    if (errBanner) {
      errBanner.hidden = true;
      errBanner.textContent = '';
    }
    form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));

    const fullName = String(nameEl.value || '').trim();
    const phone = String(phoneEl.value || '').trim();
    const message = String(msgEl?.value || '').trim();

    let hasErr = false;
    if (!fullName) {
      markField(nameEl, false);
      if (!hasErr) {
        nameEl.focus();
        hasErr = true;
      }
    } else {
      markField(nameEl, true);
    }
    if (!phone) {
      markField(phoneEl, false);
      if (!hasErr) {
        phoneEl.focus();
        hasErr = true;
      }
    } else if (!isValidPhoneInput(phone)) {
      markField(phoneEl, false);
      if (!hasErr) phoneEl.focus();
      hasErr = true;
    } else {
      markField(phoneEl, true);
    }
    if (hasErr) return;

    form.setAttribute('aria-busy', 'true');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка…';
    }

    try {
      await api('/contact', {
        method: 'POST',
        body: {
          fullName,
          phone,
          message: message || undefined,
        },
        skipAuth: true,
      });
      form.reset();
      form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
      if (note) note.hidden = false;
    } catch (err) {
      if (errBanner) {
        errBanner.textContent = err.message || 'Не удалось отправить. Попробуйте позже.';
        errBanner.hidden = false;
      }
    } finally {
      form.setAttribute('aria-busy', 'false');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultSubmitLabel;
      }
    }
  });
}

