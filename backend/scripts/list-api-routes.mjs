#!/usr/bin/env node
/**
 * Инвентарь HTTP-маршрутов runtime Express vs docs/api-route-inventory.json.
 *   node backend/scripts/list-api-routes.mjs
 *   node backend/scripts/list-api-routes.mjs --check
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV ||= 'test';
process.env.DATABASE_URL ||= 'postgresql://car_service_app:change-me@127.0.0.1:5432/car_service_test';
process.env.JWT_SECRET ||= 'ci-test-jwt-secret-min-32-chars-long!!';
process.env.LLM_ENABLED ||= 'false';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inventoryPath = join(root, 'docs', 'api-route-inventory.json');

function layerPath(layer) {
  if (layer.route?.path) return layer.route.path;
  if (layer.path) return layer.path;
  const src = layer.regexp?.source;
  if (!src || src === '^\\/?(?=\\/|$)' || layer.regexp?.fast_slash) return '';
  const cleaned = src
    .replace('^\\/', '/')
    .replace('\\/?', '')
    .replace('(?=\\/|$)', '')
    .replace(/\\\//g, '/')
    .replace(/\$$/, '')
    .replace(/^\^/, '');
  if (cleaned.includes('(?:') || cleaned.includes('(')) return '';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

function collect(stack, prefix = '') {
  const routes = [];
  for (const layer of stack || []) {
    if (layer.route) {
      const path = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/\/+/g, '/') || '/';
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all');
      for (const method of methods) {
        routes.push({ method: method.toUpperCase(), path: path.startsWith('/') ? path : `/${path}` });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const mount = layerPath(layer);
      routes.push(...collect(layer.handle.stack, `${prefix}${mount}`));
    }
  }
  return routes;
}

const { createApp } = await import('../src/app.js');
const app = createApp();
const raw = collect(app._router.stack)
  .filter((row) => row.path.startsWith('/api'))
  .map((row) => ({ method: row.method, path: row.path.replace(/\/$/, '') || '/api' }));

const uniq = [...new Map(raw.map((r) => [`${r.method} ${r.path}`, r])).values()].sort((a, b) =>
  a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
);

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  count: uniq.length,
  routes: uniq,
};

if (process.argv.includes('--check')) {
  const current = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const a = JSON.stringify(current.routes);
  const b = JSON.stringify(payload.routes);
  if (a !== b) {
    console.error(`Route inventory drift: file has ${current.count} routes, runtime has ${payload.count}.`);
    console.error('Update with: node backend/scripts/list-api-routes.mjs');
    process.exit(1);
  }
  console.log(`Route inventory OK (${payload.count} routes)`);
  process.exit(0);
}

if (process.argv.includes('--write') || !process.argv.includes('--check')) {
  writeFileSync(inventoryPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${inventoryPath} (${payload.count} routes)`);
}
