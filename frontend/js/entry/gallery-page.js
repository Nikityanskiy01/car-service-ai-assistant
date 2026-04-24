import { mountHeaderFooter } from '/js/layout.js';
import { initGalleryPage, mountCmsGallery } from '/js/gallery.js';

mountHeaderFooter({ active: 'gallery' });
await mountCmsGallery();
initGalleryPage();
