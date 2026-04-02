import { $, $$ } from './utils.js';

export function initGalleryPage() {
  const filterButtons = $$('.gallery-pro__filters [data-filter]');
  const items = $$('#galleryGrid .gallery-item');
  const lightbox = $('#galleryLightbox');
  const lightboxImg = $('#galleryLightboxImage');
  const lightboxCaption = $('#galleryLightboxCaption');
  const closeBtn = $('#galleryLightboxClose');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter || 'all';
      filterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      items.forEach((item) => {
        const cat = item.dataset.category || '';
        item.hidden = !(filter === 'all' || cat === filter);
      });
    });
  });

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const caption = item.querySelector('p');
      if (!img || !lightbox || !lightboxImg || !lightboxCaption) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || 'Изображение';
      lightboxCaption.textContent = caption?.textContent || '';
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    if (lightboxImg) lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

