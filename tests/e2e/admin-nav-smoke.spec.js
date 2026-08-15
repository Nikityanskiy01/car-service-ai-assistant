import { test, expect } from '@playwright/test';

async function loginAdmin(page) {
  await page.goto('/login');
  const quickButton = page.getByRole('button', { name: /Войти как администратор/i });
  if (await quickButton.count()) {
    await quickButton.click();
    await expect(page).not.toHaveURL(/\/login/);
    return;
  }
  await page.getByLabel('Телефон или почта').fill('admin@example.local');
  await page.getByLabel('Пароль').fill('Admin-Demo-2026!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const adminRoutes = [
  '/dashboard/admin',
  '/dashboard/admin/analytics',
  '/dashboard/admin/operations/requests',
  '/dashboard/admin/operations/bookings',
  '/dashboard/admin/operations/clients',
  '/dashboard/admin/operations/contacts',
  '/dashboard/admin/team/users',
  '/dashboard/admin/team/activity',
  '/dashboard/admin/ai/status',
  '/dashboard/admin/ai/scenarios',
  '/dashboard/admin/ai/reference',
  '/dashboard/admin/ai/memory',
  '/dashboard/admin/ai/feedback',
  '/dashboard/admin/site/items',
  '/dashboard/admin/site/blocks',
  '/dashboard/admin/site/appearance',
  '/dashboard/admin/site/legal',
  '/dashboard/admin/integrations',
  '/dashboard/admin/integrations/jobs',
  '/dashboard/admin/integrations/conflicts',
  '/dashboard/admin/security/audit',
  '/dashboard/admin/security/sessions',
];

test('admin navigates all zones', async ({ page }) => {
  await loginAdmin(page);

  for (const route of adminRoutes) {
    await page.goto(route);
    await expect(page.locator('.dashboard-shell.admin-zone')).toBeVisible();
    await expect(page.getByText('Ошибка загрузки')).toHaveCount(0);
    await expect(page.locator('h1, h2, .dashboard-topbar-title').first()).toBeVisible();
  }
});

test('admin command palette opens with Ctrl+K', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/dashboard/admin');
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog', { name: 'Командная палитра' })).toBeVisible();
  await expect(page.getByPlaceholder('Поиск разделов админки…')).toBeVisible();
});
