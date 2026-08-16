import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { joinSafeUrl } from '../../../lib/safeOutboundUrl.js';
import type { AdapterConfig, IntegrationRequestPayload, PushContext } from '../integration.types.js';
import { pickToken, pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

/** Мегаплан API v3: baseUrl инстанса + Bearer. */
export class MegaPlanAdapter {
  provider = 'MEGAPLAN';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushRequests: true,
      pushBookings: true,
      polling: true,
    };
  }

  async validateConfiguration(config: AdapterConfig) {
    const errors: string[] = [];
    validateHttpsUrl(pickUrl(config, ['baseUrl']), errors, 'URL Мегаплана');
    if (!pickToken(config)) errors.push('Укажите токен Мегаплана');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config: AdapterConfig) {
    const base = pickUrl(config, ['baseUrl']);
    return timedGet(joinSafeUrl(base, '/api/v3/employee'), this.#headers(config), 10_000);
  }

  async pushServiceRequest(request: IntegrationRequestPayload, context: PushContext) {
    const config = context?.config || {};
    const base = pickUrl(config, ['baseUrl']);
    const name = `Заявка ${request.number || request.internalId || ''}`.trim();
    const description = [request.symptoms, request.consultationSummary].filter(Boolean).join('\n');
    const { res, text, parsed } = await timedPost(
      joinSafeUrl(base, '/api/v3/deal'),
      this.#headers(config),
      {
        name,
        description,
        contacts: request.customer
          ? [{ name: request.customer.fullName, phone: request.customer.phone, email: request.customer.email }]
          : [],
      },
      20_000,
    );
    if (!res.ok) {
      throw new Error(`MEGAPLAN_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    const id = String(parsed?.data?.id || parsed?.id || '');
    return {
      externalEntityType: 'deal',
      externalEntityId: id,
      externalUrl: id ? `${base}/deals/${id}/card/` : null,
    };
  }

  #headers(config: AdapterConfig) {
    const token = pickToken(config);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
