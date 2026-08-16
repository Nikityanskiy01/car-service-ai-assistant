import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import type { AdapterConfig, IntegrationRequestPayload, PushContext } from '../integration.types.js';
import { pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

function toCsv(request: IntegrationRequestPayload) {
  const cells = [
    request.number || request.internalId || '',
    request.customer?.fullName || '',
    request.customer?.phone || '',
    request.customer?.email || '',
    [request.vehicle?.make, request.vehicle?.model].filter(Boolean).join(' '),
    request.symptoms || '',
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
  return `number,name,phone,email,vehicle,symptoms\n${cells.join(',')}`;
}

function toXml(request: IntegrationRequestPayload) {
  const escape = (value: unknown) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><request><number>${escape(request.number || request.internalId)}</number><customer>${escape(request.customer?.fullName)}</customer><phone>${escape(request.customer?.phone)}</phone><symptoms>${escape(request.symptoms)}</symptoms></request>`;
}

/** HTTPS drop: JSON / CSV / XML на согласованный URL обмена. */
export class FileExchangeAdapter {
  provider: string;

  constructor(provider = 'FILE_EXCHANGE') {
    this.provider = provider;
  }

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushRequests: true,
      pushBookings: true,
      fileExport: true,
    };
  }

  async validateConfiguration(config: AdapterConfig) {
    const errors: string[] = [];
    validateHttpsUrl(pickUrl(config, ['webhookUrl', 'baseUrl']), errors, 'URL файлового обмена');
    const format = String(config?.format || 'json').toLowerCase();
    if (!['json', 'csv', 'xml'].includes(format)) {
      errors.push('Формат обмена: json, csv или xml');
    }
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config: AdapterConfig) {
    const url = pickUrl(config, ['webhookUrl', 'baseUrl']);
    return timedGet(url, { Accept: 'application/json' }, 10_000);
  }

  async pushServiceRequest(request: IntegrationRequestPayload, context: PushContext) {
    const config = context?.config || {};
    const url = pickUrl(config, ['webhookUrl', 'baseUrl']);
    const format = String(config.format || 'json').toLowerCase();
    const body =
      format === 'csv' ? toCsv(request) : format === 'xml' ? toXml(request) : { source: 'car-service-ai-assistant', request };
    const contentType =
      format === 'csv' ? 'text/csv; charset=utf-8' : format === 'xml' ? 'application/xml; charset=utf-8' : 'application/json';
    const { res, text, parsed } = await timedPost(
      url,
      {
        'Content-Type': contentType,
        'X-Idempotency-Key': String(context?.idempotencyKey || ''),
        'X-Exchange-Format': format,
      },
      typeof body === 'string' ? body : body,
      20_000,
    );
    if (!res.ok) {
      throw new Error(`${this.provider}_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    return {
      externalEntityType: 'file_drop',
      externalEntityId: String(parsed.id || parsed.externalId || request.internalId || ''),
      externalUrl: parsed.url ? String(parsed.url) : url,
    };
  }
}
