import { mountHeaderFooter } from '/js/layout.js';
import { initLocationMapLazy, initLocationPage } from '/js/location.js';

mountHeaderFooter({ active: 'about' });
initLocationPage();

function contactsHashActive() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return false;
  return raw.split(/[?&#]/)[0] === 'contacts';
}

let mapLoadScheduled = false;

function scheduleMapLoad() {
  if (mapLoadScheduled) return;
  const contactsEl = document.getElementById('contacts');
  if (!contactsEl) return;

  const run = () => {
    if (mapLoadScheduled) return;
    mapLoadScheduled = true;
    void initLocationMapLazy();
  };

  if (contactsHashActive()) {
    run();
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    run();
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { root: null, rootMargin: '280px 0px 200px 0px', threshold: 0 },
  );
  io.observe(contactsEl);
}

scheduleMapLoad();
window.addEventListener('hashchange', () => {
  if (contactsHashActive()) scheduleMapLoad();
});
