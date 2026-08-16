const PROBLEM_BASE = 'https://autoservice.local/problems';

/**
 * RFC 9457 Problem Details + обратная совместимость `{ error, code }`.
 * @param res
 * @param opts
 */
export function sendProblem(res, { status, title, detail, code, instance, extras }: any) {
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
  if (status === 400) return 'Некорректный запрос';
  if (status === 401) return 'Требуется авторизация';
  if (status === 403) return 'Доступ запрещён';
  if (status === 404) return 'Не найдено';
  if (status === 409) return 'Конфликт';
  if (status === 422) return 'Некорректные данные';
  if (status === 429) return 'Слишком много запросов';
  if (status >= 500) return 'Внутренняя ошибка сервера';
  return 'Ошибка';
}
