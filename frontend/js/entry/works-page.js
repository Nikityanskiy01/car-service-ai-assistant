import { mountHeaderFooter } from '/js/layout.js';
import { initWorksPage, mountCmsWorks } from '/js/works.js';

mountHeaderFooter({ active: 'works' });
await mountCmsWorks();
initWorksPage();
