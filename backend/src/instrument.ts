import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/** @type */
let sdk = null;

function shouldStartTelemetry() {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.OTEL_SDK_DISABLED === 'true' || process.env.OTEL_SDK_DISABLED === '1') return false;
  return true;
}

export function startTelemetry() {
  if (sdk || !shouldStartTelemetry()) return false;
  try {
    const serviceName = process.env.OTEL_SERVICE_NAME || 'car-service-api';
    const endpoint = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim();
    sdk = new NodeSDK({
      serviceName,
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      }),
      ...(endpoint
        ? {
            traceExporter: new OTLPTraceExporter({
              url: endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1/traces`,
            }),
          }
        : {}),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          '@opentelemetry/instrumentation-runtime-node': { enabled: false },
        }),
      ],
    });
    sdk.start();
    return true;
  } catch (err) {
    console.error('opentelemetry failed to start', err);
    sdk = null;
    return false;
  }
}

export async function shutdownTelemetry() {
  if (!sdk) return;
  const current = sdk;
  sdk = null;
  await current.shutdown();
}

startTelemetry();
