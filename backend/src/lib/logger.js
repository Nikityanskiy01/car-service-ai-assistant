import pino from 'pino';
import { context, trace } from '@opentelemetry/api';

function traceFields() {
  try {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    if (!traceId || traceId === '00000000000000000000000000000000') return {};
    return { trace_id: traceId, span_id: spanId };
  } catch {
    return {};
  }
}

const level =
  process.env.NODE_ENV === 'test'
    ? 'silent'
    : process.env.NODE_ENV === 'production'
      ? 'info'
      : 'debug';

export const logger = pino({
  mixin: traceFields,
  level,
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.currentPassword',
    'req.body.newPassword',
    'req.body.code',
    'req.body.challengeToken',
    'req.body.guestToken',
    'req.body.contentBase64',
    'req.body.imageBase64',
    'req.query.email',
  ],
});
