import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoBlockingA11y(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const summary = blocking
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ')}`)
    .join('\n');
  expect(blocking, summary).toEqual([]);
}

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: 'Принять всё' });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function login(page, email, password) {
  await page.goto('/login');
  await dismissCookies(page);
  await page.getByLabel('Телефон или почта').fill(email);
  await page.locator('#loginPassword').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test.describe('a11y critical pages', () => {
  test('home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Узнайте причину неисправности/i })).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('consult', async ({ page }) => {
    await page.goto('/consult');
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: /диагностик/i })).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('client overview', async ({ page }) => {
    await login(page, 'client@example.local', 'Client-Demo-2026!');
    await page.goto('/dashboard/client');
    await expect(page.getByRole('heading', { name: 'Кабинет клиента' })).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('manager queue', async ({ page }) => {
    await login(page, 'manager@example.local', 'Manager-Demo-2026!');
    await page.goto('/dashboard/manager/requests');
    await expect(page.locator('h1, h2, .dashboard-topbar-title').first()).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('booking', async ({ page }) => {
    await page.goto('/booking');
    await expect(page.getByRole('heading', { name: 'Записаться в сервис' })).toBeVisible();
    await expectNoBlockingA11y(page);
  });

  test('register', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Регистрация' })).toBeVisible();
    await expectNoBlockingA11y(page);
  });
});
