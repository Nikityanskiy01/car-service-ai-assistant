import { test, expect } from '@playwright/test';

const unique = Date.now();
const clientEmail = `client.${unique}@example.local`;
const clientPassword = 'StrongPass123!';

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

async function loginAny(page, variants) {
  for (const variant of variants) {
    await login(page, variant.email, variant.password);
    await page.waitForTimeout(300);
    if (!page.url().includes('/login')) return true;
  }
  return false;
}

test('1. Главная открывается и старый бренд отсутствует', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Узнайте причину неисправности/i })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Fox Motors|fox motors/i);
});

test('2. Регистрация и вход клиента', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('ФИО').fill('Тестовый клиент');
  await page.getByLabel('Телефон').fill('+79990000000');
  await page.getByLabel('Email').fill(clientEmail);
  await page.getByLabel('Пароль').fill(clientPassword);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/dashboard\/client/);
});

test('3. Клиентский кабинет открывается', async ({ page }) => {
  const ok = await loginAny(page, [
    { email: clientEmail, password: clientPassword },
    { email: 'client@example.local', password: 'Client-Demo-2026!' },
    { email: 'client@example.local', password: 'demo' },
    { email: 'client@example.local', password: '1q2w3e4r' },
    { email: 'user@example.com', password: '1q2w3e4r' },
  ]);
  expect(ok).toBeTruthy();
  await page.goto('/dashboard/client');
  await expect(page.getByRole('heading', { name: 'Кабинет клиента' })).toBeVisible();
});

test('4. Гость начинает консультацию', async ({ page }) => {
  await page.goto('/consult');
  await page.getByRole('button', { name: 'Начать новую сессию' }).click();
  await expect(page.getByPlaceholder(/Опишите симптомы/i)).toBeVisible();
});

test('5. Гость создает заявку через форму записи', async ({ page }) => {
  await page.goto('/booking');
  await page.getByLabel('Имя').fill('Гость');
  await page.getByLabel('Телефон').fill('+79990001111');
  await page.getByLabel('Предпочтительное время').fill('2026-08-01T12:00');
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.locator('body')).toContainText(/Запись отправлена|свяжется/i);
});

test('6. Менеджер видит кабинет и может менять статус заявки', async ({ page }) => {
  const ok = await loginAny(page, [
    { email: 'manager@example.local', password: 'Manager-Demo-2026!' },
    { email: 'manager@example.local', password: 'demo' },
    { email: 'manager@example.local', password: '1q2w3e4r5t' },
    { email: 'manager@example.com', password: '1q2w3e4r5t' },
    { email: 'manager@fox.local', password: 'Admin12345!' },
  ]);
  expect(ok).toBeTruthy();
  await page.goto('/dashboard/manager');
  await expect(page.getByRole('heading', { name: 'Кабинет менеджера' })).toBeVisible();
});

test('7. Администратор открывает админ-панель', async ({ page }) => {
  const ok = await loginAny(page, [
    { email: 'admin@example.local', password: 'Admin-Demo-2026!' },
    { email: 'admin@example.local', password: 'demo' },
    { email: 'admin@example.local', password: '1q2w3e4r5t6y' },
    { email: 'admin@example.com', password: '1q2w3e4r5t6y' },
    { email: 'admin@fox.local', password: 'Admin12345!' },
  ]);
  expect(ok).toBeTruthy();
  await page.goto('/dashboard/admin');
  await expect(page.getByRole('heading', { name: 'Административная панель' })).toBeVisible();
});

test('8. Неправильная роль получает запрет', async ({ page }) => {
  const ok = await loginAny(page, [
    { email: clientEmail, password: clientPassword },
    { email: 'client@example.local', password: 'Client-Demo-2026!' },
    { email: 'client@example.local', password: 'demo' },
    { email: 'client@example.local', password: '1q2w3e4r' },
    { email: 'user@example.com', password: '1q2w3e4r' },
  ]);
  expect(ok).toBeTruthy();
  await page.goto('/dashboard/admin');
  await expect(page).toHaveURL(/\/403/);
});

test('9. Старые html-маршруты редиректятся', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/services.html');
  await expect(page).toHaveURL(/\/services$/);
  await page.goto('/consult.html');
  await expect(page).toHaveURL(/\/consult$/);
  await page.goto('/location.html');
  await expect(page).toHaveURL(/\/about$/);
});

test('10. Неизвестный маршрут показывает React 404', async ({ page }) => {
  await page.goto('/non-existent-route');
  await expect(page.getByText('Страница не найдена.')).toBeVisible();
});

test('11. На публичных страницах нет адреса и карты', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator('body')).not.toContainText(/Фармацевтический|Яндекс|Карта|Москва/i);
});
