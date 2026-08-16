import { GenericRestAdapter } from './adapters/genericRest.adapter.js';
import { Bitrix24Adapter } from './adapters/bitrix24.adapter.js';
import { MoySkladAdapter } from './adapters/moysklad.adapter.js';
import { GenericWebhookAdapter } from './adapters/genericWebhook.adapter.js';
import { AmoCrmAdapter } from './adapters/amocrm.adapter.js';
import { YClientsAdapter } from './adapters/yclients.adapter.js';
import { MegaPlanAdapter } from './adapters/megaplan.adapter.js';
import type { IntegrationAdapter } from './integration.types.js';
import { FileExchangeAdapter } from './adapters/fileExchange.adapter.js';

const adapters: Record<string, IntegrationAdapter> = {
  GENERIC_REST: new GenericRestAdapter('GENERIC_REST'),
  ONE_C: new GenericRestAdapter('ONE_C'),
  BITRIX24: new Bitrix24Adapter(),
  MOYSKLAD: new MoySkladAdapter(),
  GENERIC_WEBHOOK: new GenericWebhookAdapter(),
  AMOCRM: new AmoCrmAdapter(),
  YCLIENTS: new YClientsAdapter(),
  MEGAPLAN: new MegaPlanAdapter(),
  AUTODEALER_WEB: new GenericRestAdapter('AUTODEALER_WEB'),
  AUTODEALER_ONLINE: new GenericRestAdapter('AUTODEALER_ONLINE'),
  AUTODEALER_DESKTOP: new FileExchangeAdapter('AUTODEALER_DESKTOP'),
  FILE_EXCHANGE: new FileExchangeAdapter('FILE_EXCHANGE'),
};

export function getAdapter(provider: string | null | undefined) {
  const key = String(provider || '').toUpperCase();
  return adapters[key] || null;
}

export function listRegisteredProviders() {
  return Object.keys(adapters);
}
