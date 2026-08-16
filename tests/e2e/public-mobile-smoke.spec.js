import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('public home is usable on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header, .fm-header')).toBeVisible();
  await expect(page.locator('a[href="/consult"], a[href="/booking"]').first()).toBeVisible();
});
