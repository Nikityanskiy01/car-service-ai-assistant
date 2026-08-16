// @ts-check
import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(root, '.env.proxmox'));
loadEnvFile(path.join(root, 'backend/.env'));

const reuse = !process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /public-mobile-smoke/ },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testMatch: /public-mobile-smoke/ },
  ],
  webServer: [
    {
      command: 'npm --prefix backend run start',
      cwd: '.',
      url: 'http://127.0.0.1:3000/api/live',
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: '3000',
        NODE_ENV: process.env.NODE_ENV || 'development',
        LLM_ENABLED: process.env.LLM_ENABLED || 'false',
        SERVE_FRONTEND: 'false',
        DIAGNOSIS_ASYNC_ENABLED: process.env.DIAGNOSIS_ASYNC_ENABLED || 'false',
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173',
      cwd: '.',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    },
  ],
});
