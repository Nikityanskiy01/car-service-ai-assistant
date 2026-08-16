import { GenericRestAdapter } from './adapters/genericRest.adapter.js';
import { Bitrix24Adapter } from './adapters/bitrix24.adapter.js';
import { MoySkladAdapter } from './adapters/moysklad.adapter.js';
import { GenericWebhookAdapter } from './adapters/genericWebhook.adapter.js';

const adapters = {
  GENERIC_REST: new GenericRestAdapter('GENERIC_REST'),
  ONE_C: new GenericRestAdapter('ONE_C'),
  BITRIX24: new Bitrix24Adapter(),
  MOYSKLAD: new MoySkladAdapter(),
  GENERIC_WEBHOOK: new GenericWebhookAdapter(),
};

export function getAdapter(provider) {
  const key = String(provider || '').toUpperCase();
  return adapters[key] || null;
}

export function listRegisteredProviders() {
  return Object.keys(adapters);
}
