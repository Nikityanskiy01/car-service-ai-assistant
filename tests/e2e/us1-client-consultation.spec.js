import { test, expect } from '@playwright/test';

test.describe('US1 client consultation', () => {
  test('guest consult, register, claim, service request', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/consult.html');
    await expect(page.locator('#guestConsultBanner')).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.fill('#messageInput', `Сообщение ${i}`);
      await page.click('#chatForm button[type="submit"]');
      await page.waitForTimeout(400);
    }
    await expect(page.getByRole('link', { name: 'Регистрация' })).toBeVisible({ timeout: 30_000 });

    const email = `e2e_${Date.now()}@test.local`;
    await page.getByRole('link', { name: 'Регистрация' }).click();
    await expect(page).toHaveURL(/register\.html/);

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="fullName"]', 'E2E User');
    await page.fill('input[name="phone"]', '+79991234567');
    await page.click('button[type="submit"]');
    await page.waitForURL(/consult\.html/, { timeout: 30_000 });

    await expect(page.getByRole('button', { name: 'Оформить заявку в сервис' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Сохранить отчёт' }).click();
    await page.getByRole('button', { name: 'Оформить заявку в сервис' }).click();
    await page.waitForURL(/dashboards\/client/);
  });
});
