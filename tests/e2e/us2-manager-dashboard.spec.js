import { test, expect } from '@playwright/test';

test.describe('US2 manager dashboard', () => {
  test('login and see requests table', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', {
      data: { email: 'manager@fox.local', password: 'Admin12345!' },
    });
    if (login.status() !== 200) {
      test.skip(true, 'Run backend with seed: manager@fox.local / Admin12345!');
    }

    await page.goto('/login.html');
    await page.fill('input[name="email"]', 'manager@fox.local');
    await page.fill('input[name="password"]', 'Admin12345!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboards\/manager/);
    await expect(page.locator('#mgrTable')).toBeVisible();
  });
});
