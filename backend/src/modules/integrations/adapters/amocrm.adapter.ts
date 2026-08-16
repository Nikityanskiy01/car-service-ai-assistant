import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { joinSafeUrl } from '../../../lib/safeOutboundUrl.js';
import type { AdapterConfig, IntegrationRequestPayload, PushContext } from '../integration.types.js';
import { pickToken, pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

/** amoCRM API v4: baseUrl = https://{subdomain}.amocrm.ru, token = long-lived access. */
export class AmoCrmAdapter {
  provider = 'AMOCRM';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushRequests: true,
      pushBookings: true,
      webhooks: true,
    };
  }

  async validateConfiguration(config: AdapterConfig) {
    const errors: string[] = [];
    validateHttpsUrl(this.#base(config), errors, 'URL amoCRM');
    if (!pickToken(config)) errors.push('Укажите токен amoCRM');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config: AdapterConfig) {
    return timedGet(joinSafeUrl(this.#base(config), '/api/v4/account'), this.#headers(config), 10_000);
  }

  async pushServiceRequest(request: IntegrationRequestPayload, context: PushContext) {
    const config = context?.config || {};
    const name = `Заявка ${request.number || request.internalId || ''}`.trim();
    const { res, text, parsed } = await timedPost(
      joinSafeUrl(this.#base(config), '/api/v4/leads'),
      this.#headers(config),
      [
        {
          name,
          price: request.estimatedPriceFrom || 0,
          _embedded: {
            contacts: [
              {
                name: request.customer?.fullName || name,
                custom_fields_values: [
                  request.customer?.phone
                    ? { field_code: 'PHONE', values: [{ value: request.customer.phone }] }
                    : null,
                  request.customer?.email
                    ? { field_code: 'EMAIL', values: [{ value: request.customer.email }] }
                    : null,
                ].filter(Boolean),
              },
            ],
          },
        },
      ],
      20_000,
    );
    if (!res.ok) {
      throw new Error(`AMOCRM_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    const lead = Array.isArray(parsed?._embedded?.leads) ? parsed._embedded.leads[0] : parsed;
    const id = String(lead?.id || '');
    return {
      externalEntityType: 'lead',
      externalEntityId: id,
      externalUrl: id ? `${this.#base(config)}/leads/detail/${id}` : null,
    };
  }

  #base(config: AdapterConfig) {
    const direct = pickUrl(config, ['baseUrl']);
    if (direct) return direct;
    const sub = String(config?.subdomain || '').trim().replace(/\.amocrm\.ru$/i, '');
    return sub ? `https://${sub}.amocrm.ru` : '';
  }

  #headers(config: AdapterConfig) {
    const token = pickToken(config);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
