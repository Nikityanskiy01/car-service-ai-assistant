import { getUser } from './api.js';
import { uiAlert } from './ui/dialogs.js';

const STORAGE_KEY = 'fm_booking_prefill';
const CLIENT_BOOKINGS = '/dashboards/client.html#tab=bookings';
const GUEST_BOOKING_PAGE = '/book-service.html';

export function persistBookingPrefill(serviceTitle, categoryLabel) {
  if (!serviceTitle) return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      serviceTitle,
      categoryLabel: categoryLabel || '',
      ts: Date.now(),
    }),
  );
}

export function consumeBookingPrefill() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    sessionStorage.removeItem(STORAGE_KEY);
    return data;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

async function goToBooking(serviceTitle, categoryLabel) {
  const user = getUser();
  if (user && user.role !== 'CLIENT') {
    await uiAlert({
      title: 'Запись на услугу',
      message:
        'Запись на услугу доступна в кабинете клиента. Выйдите и войдите под учётной записью клиента.',
      variant: 'warn',
      okText: 'Ок',
    });
    return;
  }
  persistBookingPrefill(serviceTitle, categoryLabel);
  if (user?.role === 'CLIENT') {
    window.location.href = CLIENT_BOOKINGS;
    return;
  }
  window.location.href = GUEST_BOOKING_PAGE;
}

function categoryFromServicesSection(card) {
  const section = card.closest('.services-pro__section');
  const h2 = section?.querySelector('h2');
  if (!h2) return '';
  return h2.textContent.replace(/\s+/g, ' ').trim();
}

export function initServicesBooking() {
  document.querySelectorAll('.services-pro__item').forEach((card) => {
    card.classList.add('services-pro__item--bookable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const title = () => card.querySelector('h3')?.textContent?.trim() || '';
    card.setAttribute('aria-label', `Записаться: ${title()}`);

    const activate = (e) => {
      if (e) e.preventDefault();
      const t = title();
      if (!t) return;
      void goToBooking(t, categoryFromServicesSection(card));
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
}

export function initHomeServicesBooking() {
  document.querySelectorAll('a.home-pro__service').forEach((a) => {
    a.classList.add('home-pro__service--bookable');
    const title = () => a.querySelector('h3')?.textContent?.trim() || '';

    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = title();
      if (!t) return;
      void goToBooking(t, 'Услуги автосервиса');
    });
  });
}
