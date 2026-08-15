#!/usr/bin/env node
/**
 * Синхронизация OpenAPI с инвентарём Express-маршрутов.
 *   node backend/scripts/sync-openapi.mjs           # записать yaml
 *   node backend/scripts/sync-openapi.mjs --check   # drift vs inventory
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inventoryPath = join(root, 'docs', 'api-route-inventory.json');
const openapiPath = join(root, 'specs/001-ai-consultation-platform/contracts/openapi.yaml');

function toOpenApiPath(expressPath) {
  let p = String(expressPath || '').replace(/^\/api\/?/, '/');
  if (p === '') p = '/';
  p = p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/$/, '');
  return p === '/api' ? '/' : p;
}

function pathParams(openPath) {
  return [...openPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
}

function tagFor(openPath) {
  const seg = openPath.split('/').filter(Boolean)[0] || 'root';
  const map = {
    live: 'Ops',
    ready: 'Ops',
    health: 'Ops',
    metrics: 'Ops',
    auth: 'Auth',
    users: 'Users',
    consultations: 'Consultations',
    'service-requests': 'ServiceRequests',
    bookings: 'Bookings',
    vehicles: 'Vehicles',
    contact: 'Contact',
    content: 'Content',
    admin: 'Admin',
    analytics: 'Analytics',
    manager: 'Integrations',
    webhooks: 'Integrations',
    'product-events': 'Product',
  };
  return map[seg] || 'Other';
}

const HINTS = {
  'GET /live': 'Liveness (процесс жив, без БД)',
  'GET /ready': 'Readiness (БД и Redis при наличии)',
  'GET /health': 'Совместимый alias readiness',
  'GET /metrics': 'Prometheus text (in-process)',
  'POST /product-events': 'Продуктовое событие воронки',
  'POST /consultations': 'Создать консультацию (клиент или гость)',
  'POST /consultations/{sessionId}/messages': 'Сообщение в консультацию',
};

function yamlQuote(value) {
  if (value == null) return '""';
  const s = String(value);
  if (/[:#{}[\],&*?]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

function methodSummary(method, openPath) {
  const hint = HINTS[`${method} ${openPath}`];
  if (hint) return hint;
  const last = openPath.split('/').filter(Boolean).slice(-1)[0] || 'root';
  const verbs = { GET: 'Получить', POST: 'Создать/выполнить', PATCH: 'Обновить', PUT: 'Заменить', DELETE: 'Удалить' };
  return `${verbs[method] || method} ${last}`;
}

function buildYaml(routes) {
  /** @type {Map<string, { method: string, expressPath: string }[]>} */
  const byPath = new Map();
  for (const row of routes) {
    const openPath = toOpenApiPath(row.path);
    const list = byPath.get(openPath) || [];
    list.push({ method: row.method.toLowerCase(), expressPath: row.path });
    byPath.set(openPath, list);
  }

  const lines = [
    'openapi: 3.0.3',
    'info:',
    '  title: Car Service AI Assistant API',
    '  version: 0.5.0',
    '  description: >',
    '    Полный операционный контракт, сгенерированный из runtime Express',
    '    (`docs/api-route-inventory.json`). Схемы тел запросов — минимальные;',
    '    источник истины по наличию path+method — инвентарь + `npm run openapi:check`.',
    'servers:',
    '  - url: http://localhost:3000/api',
    'tags:',
    '  - name: Ops',
    '  - name: Auth',
    '  - name: Consultations',
    '  - name: ServiceRequests',
    '  - name: Bookings',
    '  - name: Users',
    '  - name: Vehicles',
    '  - name: Contact',
    '  - name: Content',
    '  - name: Admin',
    '  - name: Analytics',
    '  - name: Integrations',
    '  - name: Product',
    '  - name: Other',
    'paths:',
  ];

  const usedIds = new Set();
  const sortedPaths = [...byPath.keys()].sort();
  for (const openPath of sortedPaths) {
    const ops = byPath.get(openPath);
    const seen = new Set();
    lines.push(`  ${JSON.stringify(openPath)}:`);
    for (const op of ops) {
      if (seen.has(op.method)) continue;
      seen.add(op.method);
      const params = pathParams(openPath);
      let operationId = `${op.method}_${openPath.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'root'}`;
      if (usedIds.has(operationId)) {
        let n = 2;
        while (usedIds.has(`${operationId}_${n}`)) n += 1;
        operationId = `${operationId}_${n}`;
      }
      usedIds.add(operationId);
      lines.push(`    ${op.method}:`);
      lines.push(`      tags: [${tagFor(openPath)}]`);
      lines.push(`      summary: ${yamlQuote(methodSummary(op.method.toUpperCase(), openPath))}`);
      lines.push(`      operationId: ${operationId}`);
      if (params.length) {
        lines.push('      parameters:');
        for (const name of params) {
          lines.push(`        - in: path`);
          lines.push(`          name: ${name}`);
          lines.push('          required: true');
          lines.push('          schema: { type: string }');
        }
      }
      if (['post', 'patch', 'put'].includes(op.method)) {
        lines.push('      requestBody:');
        lines.push('        content:');
        lines.push('          application/json:');
        lines.push('            schema: { type: object }');
      }
      lines.push('      responses:');
      lines.push("        '200':");
      lines.push('          description: OK');
      lines.push("        '4XX':");
      lines.push('          description: Problem Details (RFC 9457)');
      lines.push('          content:');
      lines.push('            application/problem+json:');
      lines.push('              schema:');
      lines.push('                $ref: \'#/components/schemas/Problem\'');
    }
  }

  lines.push('components:');
  lines.push('  schemas:');
  lines.push('    Problem:');
  lines.push('      type: object');
  lines.push('      properties:');
  lines.push('        type: { type: string }');
  lines.push('        title: { type: string }');
  lines.push('        status: { type: integer }');
  lines.push('        detail: { type: string }');
  lines.push('        instance: { type: string }');
  lines.push('        error: { type: string }');
  lines.push('        code: { type: string }');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function listOpenApiOps(yaml) {
  const ops = [];
  let currentPath = null;
  for (const line of yaml.split('\n')) {
    const pathMatch = line.match(/^  ("(?:\\.|[^"])+"|\/\S*):$/);
    if (pathMatch) {
      const raw = pathMatch[1];
      currentPath = raw.startsWith('"') ? JSON.parse(raw) : raw;
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):$/);
    if (methodMatch && currentPath) {
      ops.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }
  return ops;
}

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const expected = inventory.routes.map((r) => ({
  method: r.method.toUpperCase(),
  path: toOpenApiPath(r.path),
}));

if (process.argv.includes('--check')) {
  const yaml = readFileSync(openapiPath, 'utf8');
  const actual = listOpenApiOps(yaml);
  const a = new Set(expected.map((r) => `${r.method} ${r.path}`));
  const b = new Set(actual.map((r) => `${r.method} ${r.path}`));
  const missing = [...a].filter((k) => !b.has(k));
  const extra = [...b].filter((k) => !a.has(k));
  if (missing.length || extra.length) {
    console.error(`OpenAPI drift: inventory ${a.size} ops, spec ${b.size} ops.`);
    if (missing.length) console.error(`Missing in OpenAPI (${missing.length}): ${missing.slice(0, 12).join(', ')}`);
    if (extra.length) console.error(`Extra in OpenAPI (${extra.length}): ${extra.slice(0, 12).join(', ')}`);
    console.error('Update with: npm run openapi:sync');
    process.exit(1);
  }
  console.log(`OpenAPI OK (${b.size} operations, ${inventory.count} inventory routes)`);
  process.exit(0);
}

mkdirSync(dirname(openapiPath), { recursive: true });
writeFileSync(openapiPath, buildYaml(inventory.routes));
console.log(`Wrote ${openapiPath} (${expected.length} operations)`);
