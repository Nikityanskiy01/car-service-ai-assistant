import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { joinSafeUrl } from '../../../lib/safeOutboundUrl.js';
import type { AdapterConfig, IntegrationRequestPayload, PushContext } from '../integration.types.js';
import { pickToken, pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

const DEFAULT_BASE = 'https://api.yclients.com/api/v1';

/** YCLIENTS partner API v1: partner token + companyId. */
export class YClientsAdapter {
  provider = 'YCLIENTS';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushBookings: true,
      pushRequests: true,
      polling: true,
    };
  }

  async validateConfiguration(config: AdapterConfig) {
    const errors: string[] = [];
    if (!pickToken(config)) errors.push('Укажите partner-токен YCLIENTS');
    if (!String(config?.companyId || '').trim()) errors.push('Укажите companyId филиала YCLIENTS');
    validateHttpsUrl(pickUrl(config, ['baseUrl'], DEFAULT_BASE), errors, 'URL API YCLIENTS');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config: AdapterConfig) {
    const base = pickUrl(config, ['baseUrl'], DEFAULT_BASE);
    const companyId = String(config?.companyId || '').trim();
    return timedGet(joinSafeUrl(base, `/company/${companyId}`), this.#headers(config), 10_000);
  }

  async pushServiceRequest(request: IntegrationRequestPayload, context: PushContext) {
    const config = context?.config || {};
    const base = pickUrl(config, ['baseUrl'], DEFAULT_BASE);
    const companyId = String(config.companyId || '').trim();
    const comment = [
      `Заявка ${request.number || request.internalId || ''}`,
      request.symptoms,
      request.consultationSummary,
    ]
      .filter(Boolean)
      .join('\n');
    const { res, text, parsed } = await timedPost(
      joinSafeUrl(base, `/records/${companyId}`),
      this.#headers(config),
      {
        phone: request.customer?.phone || '',
        fullname: request.customer?.fullName || '',
        email: request.customer?.email || '',
        comment,
        save_if_busy: true,
      },
      20_000,
    );
    if (!res.ok) {
      throw new Error(`YCLIENTS_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    const id = String(parsed?.data?.id || parsed?.id || '');
    return {
      externalEntityType: 'record',
      externalEntityId: id,
      externalUrl: null,
    };
  }

  #headers(config: AdapterConfig) {
    const token = pickToken(config);
    return {
      Accept: 'application/vnd.yclients.v2+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }
}
