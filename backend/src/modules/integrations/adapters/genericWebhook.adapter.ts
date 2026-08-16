import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { pickUrl, timedGet, timedPost, validateHttpsUrl } from './httpCrm.shared.js';

export class GenericWebhookAdapter {
  provider = 'GENERIC_WEBHOOK';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushRequests: true,
      pushBookings: true,
      webhooks: true,
    };
  }

  async validateConfiguration(config) {
    const errors = [];
    validateHttpsUrl(pickUrl(config, ['webhookUrl', 'baseUrl']), errors, 'URL вебхука');
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config) {
    const url = pickUrl(config, ['webhookUrl', 'baseUrl']);
    return timedGet(url, {}, 10_000);
  }

  async pushServiceRequest(request, context) {
    const config = context?.config || {};
    const url = pickUrl(config, ['webhookUrl', 'baseUrl']);
    const { res, text, parsed } = await timedPost(
      url,
      { 'X-Idempotency-Key': String(context?.idempotencyKey || '') },
      { source: 'car-service-ai-assistant', event: 'service_request.created', request },
      20_000,
    );
    if (!res.ok) {
      throw new Error(`GENERIC_WEBHOOK_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    return {
      externalEntityType: 'webhook',
      externalEntityId: String(parsed.id || parsed.externalId || ''),
      externalUrl: parsed.url ? String(parsed.url) : url,
    };
  }
}
