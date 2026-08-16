import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { joinSafeUrl } from '../../../lib/safeOutboundUrl.js';
import { pickToken, pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

const DEFAULT_BASE = 'https://api.moysklad.ru/api/remap/1.2';

export class MoySkladAdapter {
  provider = 'MOYSKLAD';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushRequests: true,
      pushBookings: true,
      polling: true,
    };
  }

  async validateConfiguration(config) {
    const errors = [];
    if (!pickToken(config)) errors.push('Укажите токен МойСклад');
    const base = pickUrl(config, ['baseUrl'], DEFAULT_BASE);
    validateHttpsUrl(base, errors, 'URL API МойСклад');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config) {
    const base = pickUrl(config, ['baseUrl'], DEFAULT_BASE);
    return timedGet(joinSafeUrl(base, '/entity/organization'), this.#headers(config), 10_000);
  }

  async pushServiceRequest(request, context) {
    const config = context?.config || {};
    const base = pickUrl(config, ['baseUrl'], DEFAULT_BASE);
    const description = [
      `Заявка ${request.number || request.internalId || ''}`,
      request.symptoms,
      request.consultationSummary,
    ]
      .filter(Boolean)
      .join('\n');
    const { res, text, parsed } = await timedPost(
      joinSafeUrl(base, '/entity/customerorder'),
      this.#headers(config),
      {
        name: String(request.number || request.internalId || `order-${Date.now()}`),
        description,
        applicable: false,
      },
      20_000,
    );
    if (!res.ok) {
      throw new Error(`MOYSKLAD_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    return {
      externalEntityType: 'customerorder',
      externalEntityId: String(parsed.id || ''),
      externalUrl: parsed.meta?.uuidHref ? String(parsed.meta.uuidHref) : null,
    };
  }

  #headers(config) {
    const token = pickToken(config);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
