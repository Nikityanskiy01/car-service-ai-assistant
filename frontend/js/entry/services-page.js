import { mountHeaderFooter } from '/js/layout.js';
import { initServicesBooking, mountCmsServices } from '/js/services-page.js';

mountHeaderFooter({ active: 'services' });
await mountCmsServices();
initServicesBooking();
