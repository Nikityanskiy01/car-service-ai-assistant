import { DEFAULT_CAPABILITIES } from '../integration.constants.js';
import { assertSafeOutboundUrl, assertSafeOutboundUrlResolved, joinSafeUrl } from '../../../lib/safeOutboundUrl.js';

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeError(err) {
  const msg = err instanceof Error ? err.message : String(err || 'unknown');
  return msg.slice(0, 300);
}

export class GenericRestAdapter {
  provider = 'GENERIC_REST';

  async getCapabilities() {
    return {
      ...DEFAULT_CAPABILITIES,
      pushCustomers: true,
      pushVehicles: true,
      pushRequests: true,
      pushBookings: true,
      pushConsultations: true,
      webhooks: true,
      polling: true,
      bidirectionalSync: true,
    };
  }

  async validateConfiguration(config) {
    const errors = [];
    const baseUrl = String(config?.baseUrl || '').trim();
    if (!baseUrl) errors.push('Укажите базовый URL');
    if (baseUrl) {
      try {
        assertSafeOutboundUrl(baseUrl, { allowHttp: false });
      } catch (err) {
        errors.push(err?.message || 'Небезопасный базовый URL');
      }
    }
    const authType = String(config?.authType || '').trim();
    if (authType && !['bearer', 'basic', 'none'].includes(authType)) {
      errors.push('Поддерживаются только authType: bearer/basic/none');
    }
    return { ok: errors.length === 0, errors };
  }

  async testConnection(config) {
    const baseUrl = String(config?.baseUrl || '').replace(/\/+$/, '');
    const healthPath = String(config?.healthPath || '/health');
    const timeoutMs = Number(config?.timeoutMs) > 0 ? Number(config.timeoutMs) : 10_000;
    const authHeaders = this.#buildAuthHeaders(config);
    const startedAt = Date.now();
    try {
      await assertSafeOutboundUrlResolved(baseUrl, { allowHttp: false });
      const url = joinSafeUrl(baseUrl, healthPath);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
      const text = await res.text().catch(() => '');
      return {
        ok: res.ok,
        httpStatus: res.status,
        latencyMs: Date.now() - startedAt,
        message: res.ok ? 'Подключение успешно' : `Внешняя система ответила со статусом ${res.status}`,
        details: safeJsonParse(text) || text.slice(0, 300),
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: null,
        latencyMs: Date.now() - startedAt,
        message: 'Не удалось подключиться к внешней системе',
        details: normalizeError(err),
      };
    }
  }

  async pushServiceRequest(request, context) {
    const config = context?.config || {};
    const baseUrl = String(config?.baseUrl || '').replace(/\/+$/, '');
    const endpoint = String(config?.requestEndpoint || '/service-requests');
    const timeoutMs = Number(config?.timeoutMs) > 0 ? Number(config.timeoutMs) : 20_000;
    const authHeaders = this.#buildAuthHeaders(config);
    await assertSafeOutboundUrlResolved(baseUrl, { allowHttp: false });
    const url = joinSafeUrl(baseUrl, endpoint);
    const payload = {
      source: 'car-service-ai-assistant',
      request: {
        internalId: request.internalId,
        number: request.number,
        status: request.internalStatus,
        urgency: request.urgency,
        confidence: request.confidence,
        estimatedPriceFrom: request.estimatedPriceFrom,
        customer: request.customer,
        vehicle: request.vehicle,
        symptoms: request.symptoms,
        consultationSummary: request.consultationSummary,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders,
        'X-Idempotency-Key': String(context?.idempotencyKey || ''),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const text = await res.text().catch(() => '');
    const parsed = safeJsonParse(text) || {};
    if (!res.ok) {
      throw new Error(`GENERIC_REST_PUSH_FAILED:${res.status}:${String(text).slice(0, 220)}`);
    }
    return {
      externalEntityType: 'service_request',
      externalEntityId: String(parsed.id || parsed.externalId || parsed.number || ''),
      externalUrl: parsed.url ? String(parsed.url) : null,
    };
  }

  #buildAuthHeaders(config) {
    const authType = String(config?.authType || 'none').toLowerCase();
    if (authType === 'bearer' && config?.apiToken) {
      return { Authorization: `Bearer ${String(config.apiToken)}` };
    }
    if (authType === 'basic' && config?.username && config?.password) {
      const base = Buffer.from(`${String(config.username)}:${String(config.password)}`).toString('base64');
      return { Authorization: `Basic ${base}` };
    }
    return {};
  }
}
