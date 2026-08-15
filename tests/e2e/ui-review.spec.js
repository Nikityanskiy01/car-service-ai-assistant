import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('artifacts/ui-review');

async function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

async function loginWithFallback(page, role) {
  await page.goto('/login');
  const quickButton = page.getByRole('button', { name: new RegExp(`Войти как ${role}`, 'i') });
  if (await quickButton.count()) {
    await quickButton.click();
    return;
  }
  const creds = {
    клиент: [
      { email: 'client@example.local', password: 'Client-Demo-2026!' },
      { email: 'client@example.local', password: 'demo' },
      { email: 'client@example.local', password: '1q2w3e4r' },
      { email: 'user@example.com', password: '1q2w3e4r' },
    ],
    менеджер: [
      { email: 'manager@example.local', password: 'Manager-Demo-2026!' },
      { email: 'manager@example.local', password: 'demo' },
      { email: 'manager@example.local', password: '1q2w3e4r5t' },
      { email: 'manager@example.com', password: '1q2w3e4r5t' },
    ],
    администратор: [
      { email: 'admin@example.local', password: 'Admin-Demo-2026!' },
      { email: 'admin@example.local', password: 'demo' },
      { email: 'admin@example.local', password: '1q2w3e4r5t6y' },
      { email: 'admin@example.com', password: '1q2w3e4r5t6y' },
    ],
  }[role];
  for (const variant of creds) {
    await page.getByLabel('Телефон или почта').fill(variant.email);
    await page.getByLabel('Пароль').fill(variant.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForTimeout(500);
    if (!page.url().includes('/login')) return;
  }
}

test('capture ui review screenshots', async ({ page }) => {
  await ensureDir();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: path.join(outDir, 'home-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.screenshot({ path: path.join(outDir, 'home-mobile.png'), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/consult');
  await page.screenshot({ path: path.join(outDir, 'consult-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/consult');
  await page.screenshot({ path: path.join(outDir, 'consult-mobile.png'), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/consult');
  const startBtn = page.getByRole('button', { name: /Начать консультацию|Начать новую сессию/i });
  if (await startBtn.count()) await startBtn.first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'analysis-result.png'), fullPage: true });

  await loginWithFallback(page, 'клиент');
  await page.goto('/dashboard/client');
  await page.screenshot({ path: path.join(outDir, 'client-dashboard.png'), fullPage: true });

  await loginWithFallback(page, 'менеджер');
  await page.goto('/dashboard/manager');
  await page.screenshot({ path: path.join(outDir, 'manager-dashboard.png'), fullPage: true });
  await page.screenshot({ path: path.join(outDir, 'manager-request-detail.png'), fullPage: true });
  const kanbanTab = page.getByRole('tab', { name: 'Канбан' });
  if (await kanbanTab.count()) {
    await kanbanTab.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outDir, 'manager-kanban.png'), fullPage: true });

  await loginWithFallback(page, 'администратор');
  await page.goto('/dashboard/admin');
  await page.screenshot({ path: path.join(outDir, 'admin-panel.png'), fullPage: true });
  const analyticsTab = page.getByRole('tab', { name: 'Аналитика' });
  if (await analyticsTab.count()) {
    await analyticsTab.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outDir, 'analytics.png'), fullPage: true });

  await page.addInitScript(() => localStorage.setItem('car_service_theme_mode', 'dark'));
  await page.goto('/');
  await page.screenshot({ path: path.join(outDir, 'dark-theme.png'), fullPage: true });
});
