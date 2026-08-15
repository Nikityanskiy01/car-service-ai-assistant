// @ts-check
import { defineConfig, devices } from '@playwright/test';

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.PW_MOBILE === '1'
      ? [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }]
      : []),
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
