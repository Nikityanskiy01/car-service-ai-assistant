import { test, expect } from '@playwright/test';

test('consult page progress and chat layout', async ({ page }) => {
  await page.goto('/consult.html');
  await expect(page.locator('.progress')).toBeVisible();
  await expect(page.locator('#chat')).toBeVisible();
});
