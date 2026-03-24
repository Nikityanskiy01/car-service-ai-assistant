import { test, expect } from '@playwright/test';

const pages = ['/', '/about.html', '/gallery.html', '/works.html', '/location.html'];

for (const p of pages) {
  test(`public ${p} desktop`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(p);
    await expect(page.locator('header.site-header')).toBeVisible();
  });
}

test('public home mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.brand')).toBeVisible();
});
