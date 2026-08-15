const PROBLEM_BASE = 'https://autoservice.local/problems';

/**
 * RFC 9457 Problem Details + обратная совместимость `{ error, code }`.
 * @param {import('express').Response} res
 * @param {{ status: number, title?: string, detail: string, code?: string, instance?: string, extras?: Record<string, unknown> }} opts
 */
export function sendProblem(res, { status, title, detail, code, instance, extras }) {
  const body = {
    type: code ? `${PROBLEM_BASE}/${encodeURIComponent(code)}` : 'about:blank',
    title: title || statusTitle(status),
    status,
    detail,
    instance: instance || undefined,
    error: detail,
    code: code || undefined,
    ...extras,
  };
  if (!body.instance) delete body.instance;
  if (!body.code) delete body.code;
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  return res.status(status).json(body);
}

function statusTitle(status) {
  if (status === 400) return 'Bad Request';
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not Found';
  if (status === 409) return 'Conflict';
  if (status === 422) return 'Unprocessable Entity';
  if (status === 429) return 'Too Many Requests';
  if (status >= 500) return 'Internal Server Error';
  return 'Error';
}
