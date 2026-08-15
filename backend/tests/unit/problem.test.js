import { describe, expect, it } from '@jest/globals';
import { sendProblem } from '../../src/lib/problem.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('RFC 9457 problem details', () => {
  it('keeps backward-compatible error and code', () => {
    const res = mockRes();
    sendProblem(res, { status: 400, detail: 'bad', code: 'VALIDATION_ERROR', instance: '/requests/1' });
    expect(res.statusCode).toBe(400);
    expect(res.headers['Content-Type']).toContain('application/problem+json');
    expect(res.body.error).toBe('bad');
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.type).toContain('VALIDATION_ERROR');
    expect(res.body.instance).toBe('/requests/1');
  });
});
