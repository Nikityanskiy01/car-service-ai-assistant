import type { Response } from 'express';

const PROBLEM_BASE = 'https://autoservice.local/problems';

export type ProblemOptions = {
  status: number;
  title?: string;
  detail: string;
  code?: string;
  instance?: string;
  extras?: Record<string, unknown>;
};

/**
 * RFC 9457 Problem Details. Поля `error`/`code` остаются для клиентов,
 * которые ещё читают старый конверт.
 */
export function sendProblem(res: Response, { status, title, detail, code, instance, extras }: ProblemOptions) {
  const body: Record<string, unknown> = {
    type: code ? `${PROBLEM_BASE}/${encodeURIComponent(code)}` : 'about:blank',
    title: title || statusTitle(status),
    status,
    detail,
    error: detail,
    ...extras,
  };
  if (instance) body.instance = instance;
  if (code) body.code = code;
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  return res.status(status).json(body);
}

function statusTitle(status: number) {
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
