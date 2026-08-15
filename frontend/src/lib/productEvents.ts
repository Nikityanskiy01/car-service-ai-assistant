import { api } from '../api/client';

export function trackProductEvent(name: string, props?: Record<string, string | number | boolean | null>) {
  void api('/product-events', { method: 'POST', body: { name, props } }).catch(() => undefined);
}
