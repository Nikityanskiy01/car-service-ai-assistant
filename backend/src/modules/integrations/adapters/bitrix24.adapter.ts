import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { joinSafeUrl } from '../../../lib/safeOutboundUrl.js';
import { pickToken, pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

/** Incoming webhook Bitrix24: baseUrl = https://xxx.bitrix24.ru/rest/1/{token}/ */
export class Bitrix24Adapter {
  provider = 'BITRIX24';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushRequests: true,
      pushBookings: true,
      webhooks: true,
    };
  }

  async validateConfiguration(config) {
    const errors = [];
    const webhook = this.#webhookBase(config);
    validateHttpsUrl(webhook, errors, 'URL входящего вебхука Bitrix24');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config) {
    const base = this.#webhookBase(config);
    return timedGet(joinSafeUrl(base, 'app.info.json'), {}, 10_000);
  }

  async pushServiceRequest(request, context) {
    const config = context?.config || {};
    const base = this.#webhookBase(config);
    const title = `Заявка ${request.number || request.internalId || ''}`.trim();
    const comments = [
      request.symptoms,
      request.consultationSummary,
      request.vehicle ? `${request.vehicle.make || ''} ${request.vehicle.model || ''}`.trim() : '',
    ]
      .filter(Boolean)
      .join('\n');
    const { res, text, parsed } = await timedPost(
      joinSafeUrl(base, 'crm.lead.add.json'),
      {},
      {
        fields: {
          TITLE: title,
          NAME: request.customer?.fullName || '',
          PHONE: request.customer?.phone ? [{ VALUE: request.customer.phone, VALUE_TYPE: 'WORK' }] : [],
          EMAIL: request.customer?.email ? [{ VALUE: request.customer.email, VALUE_TYPE: 'WORK' }] : [],
          COMMENTS: comments,
          UF_CRM_SOURCE: 'car-service-ai-assistant',
        },
      },
      20_000,
    );
    if (!res.ok || parsed.error) {
      throw new Error(`BITRIX24_PUSH_FAILED:${res.status}:${String(parsed.error_description || text).slice(0, 220)}`);
    }
    const id = String(parsed.result || parsed.id || '');
    return {
      externalEntityType: 'crm_lead',
      externalEntityId: id,
      externalUrl: id ? `${base.replace(/\/rest\/.*$/, '')}/crm/lead/details/${id}/` : null,
    };
  }

  #webhookBase(config) {
    const url = pickUrl(config, ['webhookUrl', 'baseUrl']);
    const token = pickToken(config);
    if (url && token && !url.includes(token)) {
      return `${url}/${token}`;
    }
    return url;
  }
}
